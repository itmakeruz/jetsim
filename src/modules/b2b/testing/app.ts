import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@prisma';
import { createHash } from 'crypto';
import { HttpExceptionFilter } from '../../../common/exceptions/http-exceptions.exception';
import { UsageService } from '../../usage/usage.service';
import { OrdersAdminService } from '../admin/orders-admin.service';
import { ResellersAdminController } from '../admin/resellers-admin.controller';
import { ResellersAdminService } from '../admin/resellers-admin.service';
import { ManagementKeyGuard } from '../guards/management-key.guard';
import { ResellerKeyGuard } from '../guards/reseller-key.guard';
import { B2bIssuanceService } from '../issuance/b2b-issuance.service';
import { B2bSettlementService } from '../issuance/b2b-settlement.service';
import { B2bAlerts, ProviderSubmitter } from '../issuance/provider-submitter';
import { ResellerLedgerService } from '../ledger/reseller-ledger.service';
import { B2bCatalogService } from '../purchase/b2b-catalog.service';
import { B2bEsimService } from '../purchase/b2b-esim.service';
import { B2bOrdersService } from '../purchase/b2b-orders.service';
import { B2bPurchaseController } from '../purchase/b2b-purchase.controller';

export const MGMT_KEY = 'test-management-key';

/** Тестовое приложение: настоящие сервисы и Postgres, поддельные поставщик, оповещения и расход. */
export async function createB2bTestApp(prisma: PrismaService) {
  const submitter = { submit: jest.fn() };
  const alerts = { reconcileNeeded: jest.fn().mockResolvedValue(undefined) };
  const usage = { forSim: jest.fn() };
  const cfg: Record<string, string> = {
    B2B_MANAGEMENT_KEY_HASH: createHash('sha256').update(MGMT_KEY).digest('hex'),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [ResellersAdminController, B2bPurchaseController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: { get: (k: string) => cfg[k] } },
      ManagementKeyGuard,
      ResellerKeyGuard,
      ResellerLedgerService,
      ResellersAdminService,
      OrdersAdminService,
      B2bCatalogService,
      B2bOrdersService,
      B2bEsimService,
      B2bIssuanceService,
      B2bSettlementService,
      { provide: ProviderSubmitter, useValue: submitter },
      { provide: B2bAlerts, useValue: alerts },
      { provide: UsageService, useValue: usage },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const issuance = moduleRef.get(B2bIssuanceService);
  // Фоновый запуск отправки в тестах отключён: отправку вызываем явно и детерминированно
  const enqueue = jest.spyOn(issuance, 'enqueue').mockImplementation(() => undefined);

  return { app, submitter, alerts, usage, issuance, enqueue, settlement: moduleRef.get(B2bSettlementService), ledger: moduleRef.get(ResellerLedgerService) };
}
