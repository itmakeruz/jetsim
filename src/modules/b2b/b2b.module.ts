import { OperationsController } from './admin/operations.controller';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { TelegramBotService } from 'src/common/helpers/telegram-bot.service';
import { OrderModule } from '../order/order.module';
import { UsageModule } from '../usage/usage.module';
import { OrdersAdminService } from './admin/orders-admin.service';
import { ResellersAdminController } from './admin/resellers-admin.controller';
import { ResellersAdminService } from './admin/resellers-admin.service';
import { ManagementKeyGuard } from './guards/management-key.guard';
import { ResellerKeyGuard } from './guards/reseller-key.guard';
import { B2bAlertsService } from './issuance/b2b-alerts.service';
import { B2bIssuanceService } from './issuance/b2b-issuance.service';
import { B2bSettlementService } from './issuance/b2b-settlement.service';
import { DefaultProviderSubmitter } from './issuance/default-provider-submitter';
import { B2bAlerts, ProviderSubmitter } from './issuance/provider-submitter';
import { ResellerLedgerService } from './ledger/reseller-ledger.service';
import { B2bCatalogService } from './purchase/b2b-catalog.service';
import { B2bEsimService } from './purchase/b2b-esim.service';
import { B2bOrdersService } from './purchase/b2b-orders.service';
import { B2bPurchaseController } from './purchase/b2b-purchase.controller';

@Module({
  imports: [PrismaModule, OrderModule, UsageModule, ScheduleModule.forRoot()],
  controllers: [OperationsController, ResellersAdminController, B2bPurchaseController],
  providers: [
    WinstonLoggerService,
    TelegramBotService,
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
    { provide: ProviderSubmitter, useClass: DefaultProviderSubmitter },
    { provide: B2bAlerts, useClass: B2bAlertsService },
  ],
  exports: [ResellerLedgerService],
})
export class B2bModule {}
