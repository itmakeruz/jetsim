import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { sign } from 'jsonwebtoken';
import * as request from 'supertest';
import { TariffController } from './tariff.controller';
import { TariffService } from './tariff.service';

// Actual JWT and role guards, no production keys or accounts.
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() { super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: 'tariff-test-only' }); }
  validate(payload: any) { return payload; }
}

describe('Tariff management permissions and visibility validation', () => {
  let app: INestApplication;
  const service = { update: jest.fn().mockResolvedValue({ success: true }), findAllAdmin: jest.fn().mockResolvedValue({ data: [] }) };
  const token = (role: string) => sign({ id: 1, roles: [role] }, 'tariff-test-only');
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [TariffController], providers: [TestJwtStrategy, { provide: TariffService, useValue: service }] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => jest.clearAllMocks());
  it('rejects anonymous reads and changes', async () => {
    await request(app.getHttpServer()).get('/tariff/admin').expect(401);
    await request(app.getHttpServer()).patch('/tariff/1').send({ hide_site: true }).expect(401);
    expect(service.update).not.toHaveBeenCalled();
  });
  it.each(['USER', 'AGENT', 'ACCOUNTANT'])('rejects %s changes', async (role) => {
    await request(app.getHttpServer()).patch('/tariff/1').auth(token(role), { type: 'bearer' }).send({ hide_site: true }).expect(403);
    expect(service.update).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'SUPER_ADMIN'])('allows %s to hide and unhide with actual booleans', async (role) => {
    for (const hide_site of [true, false]) {
      await request(app.getHttpServer()).patch('/tariff/1').auth(token(role), { type: 'bearer' }).send({ hide_site }).expect(200);
      expect(service.update).toHaveBeenLastCalledWith(1, expect.objectContaining({ hide_site }));
    }
  });
  it.each(['false', 'true', 0, 1, {}])('rejects non-boolean visibility %j instead of silently hiding', async (hide_site) => {
    await request(app.getHttpServer()).patch('/tariff/1').auth(token('ADMIN'), { type: 'bearer' }).send({ hide_site }).expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });
});
