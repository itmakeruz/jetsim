import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { PartnerIds } from '@enums';
import { CreateSimService } from '../../order/create-sim/create-sim.service';
import { MobilineActivationService } from '../../order/mobiline-activation.service';
import { ProviderSubmitInput, ProviderSubmitter, SubmitOutcome } from './provider-submitter';

/** Боевая реализация: переиспользует существующие сервисы выпуска у поставщиков, не имитируя оплату Т-Банка. */
@Injectable()
export class DefaultProviderSubmitter extends ProviderSubmitter {
  constructor(
    private readonly createSim: CreateSimService,
    private readonly mobiline: MobilineActivationService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async submit(input: ProviderSubmitInput): Promise<SubmitOutcome> {
    const item = {
      id: input.simId,
      partner_id: input.partnerId,
      tariff: { id: input.tariff.id, sku_id: input.tariff.sku_id, validity_period: input.tariff.validity_period },
      // У служебного пользователя компании нет email — BillionConnect получает заявку без него
      user: { name: input.userName, email: undefined as string | undefined },
    };

    switch (input.providerNumber) {
      case PartnerIds.JOYTEL:
        return this.createSim.submitJoyTelForB2b(input.orderId, item);
      case PartnerIds.BILLION_CONNECT:
        return this.createSim.submitBillionForB2b(input.orderId, item);
      case PartnerIds.MOBILINE: {
        // submit() сам помечает SIM FAILED при достоверном отказе и оставляет PENDING при неизвестном исходе
        await this.mobiline.submit(input.orderId, item);
        const sim = await this.prisma.sims.findUnique({ where: { id: input.simId }, select: { status: true } });
        if (sim?.status === 'FAILED') return { kind: 'REJECTED', reason: 'Заявка отклонена поставщиком' };
        if (sim?.status === 'PENDING') return { kind: 'UNKNOWN', reason: 'Результат заявки неизвестен' };
        return { kind: 'ACCEPTED' };
      }
      default:
        return { kind: 'REJECTED', reason: 'Неподдерживаемый поставщик' };
    }
  }
}
