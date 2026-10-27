import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as passport from 'passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import { UserRoles } from '@prisma/client';
import { SimsController } from '../sims/sims.controller';
import { SimsService } from '../sims/sims.service';
import { UsageService } from './usage.service';
import { OrderController } from '../order/order.controller';
import { OrderService } from '../order/order.service';
import { MobilineActivationService } from '../order/mobiline-activation.service';
import { HttpExceptionFilter } from '../../common/exceptions/http-exceptions.exception';
const request = require('supertest');

// Exercise real JWT and role guards without contacting providers, Redis or a database.
describe('Usage HTTP authorization and Mobiline callback validation', () => {
  let app: INestApplication;
  const prisma = { sims: { findFirst: jest.fn(), update: jest.fn() } };
  const joytel = { getUsageResponse: jest.fn() };
  const mobiline = { callback: jest.fn().mockResolvedValue({ success: true }) };
  const token = (id: number, roles: UserRoles[] = []) => jwt.sign({ id, roles }, 'usage-test-secret');
  beforeAll(async () => {
    passport.use(
      'jwt',
      new Strategy(
        { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: 'usage-test-secret' },
        (payload, done) => done(null, payload),
      ),
    );
    const module = await Test.createTestingModule({
      controllers: [SimsController, OrderController],
      providers: [
        { provide: SimsService, useValue: {} },
        { provide: OrderService, useValue: {} },
        { provide: MobilineActivationService, useValue: mobiline },
        { provide: UsageService, useValue: new UsageService(prisma as any, joytel as any, {} as any, {} as any) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    passport.unuse('jwt');
  });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sims.findFirst.mockImplementation(async ({ where }) =>
      where.user_id !== undefined && where.user_id !== 5
        ? null
        : {
            id: 1,
            user_id: 5,
            status: 'COMPLETED',
            coupon: 'PIN',
            partner: { identified_number: 1 },
            tariff: { quantity_internet: 5, validity_period: 10 },
          },
    );
    joytel.getUsageResponse.mockResolvedValue({ code: '000', data: { totalUsage: 1048576 } });
  });
  it('rejects anonymous client and staff requests', async () => {
    await request(app.getHttpServer()).get('/sims/1/usage').expect(401);
    await request(app.getHttpServer()).get('/sims/admin/1/usage').expect(401);
  });
  it('hides another customer SIM', async () => {
    await request(app.getHttpServer()).get('/sims/1/usage').auth(token(99), { type: 'bearer' }).expect(404);
    expect(joytel.getUsageResponse).not.toHaveBeenCalled();
  });
  it('returns normalized usage for the owner', async () => {
    const response = await request(app.getHttpServer())
      .get('/sims/1/usage')
      .auth(token(5), { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({ status: 'ok', data: { used_mb: 1, total_mb: 5120 } });
  });
  it('rejects ordinary customers on the admin endpoint', async () => {
    await request(app.getHttpServer()).get('/sims/admin/1/usage').auth(token(5), { type: 'bearer' }).expect(403);
  });
  it.each([UserRoles.ADMIN, UserRoles.SUPER_ADMIN])('permits staff role %s', async (role) => {
    await request(app.getHttpServer())
      .get('/sims/admin/1/usage')
      .auth(token(99, [role]), { type: 'bearer' })
      .expect(200);
  });
  it('preserves the last successful snapshot through the error filter', async () => {
    prisma.sims.findFirst.mockResolvedValue({
      id: 1,
      status: 'COMPLETED',
      partner: { identified_number: 1 },
      tariff: {},
      coupon: 'PIN',
      usage_snapshot: { used_mb: 25 },
    });
    joytel.getUsageResponse.mockRejectedValue(new Error('upstream private detail'));
    const response = await request(app.getHttpServer())
      .get('/sims/1/usage')
      .auth(token(5), { type: 'bearer' })
      .expect(502);
    expect(response.body.last_success).toEqual({ status: 'ok', data: { used_mb: 25 } });
    expect(JSON.stringify(response.body)).not.toContain('private detail');
  });
  it('exposes the agreed callback URL without requiring a user token', async () => {
    await request(app.getHttpServer())
      .post('/order/mobiline/callback')
      .send({
        channel_order_id: 'G123',
        ret: 0,
        data: { product_type_cd: 'ESIM', cid: 'CID', qrcode: 'LPA:1$server$token' },
      })
      .expect(200, { success: true });
    expect(mobiline.callback).toHaveBeenCalledWith(
      expect.objectContaining({ ret: '0', data: expect.objectContaining({ cid: 'CID' }) }),
    );
  });
  it('rejects a boolean ret instead of treating it as a provider refusal', async () => {
    await request(app.getHttpServer())
      .post('/order/mobiline/callback')
      .send({ channel_order_id: 'G123', ret: true })
      .expect(400);
    expect(mobiline.callback).not.toHaveBeenCalled();
  });
  it('rejects malformed callback bodies before invoking the handler', async () => {
    await request(app.getHttpServer()).post('/order/mobiline/callback').send({ ret: 0 }).expect(400);
    expect(mobiline.callback).not.toHaveBeenCalled();
  });
});
