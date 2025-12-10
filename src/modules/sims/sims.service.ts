import { PartnerIds } from '@enums';
import { paginate } from '@helpers';
import { BillionConnectService, HttpService, JoyTel } from '@http';
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { sim_not_found } from '@constants';
import { OrderStatus } from '@prisma/client';
import { WinstonLoggerService } from '@logger';

@Injectable()
export class SimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTelService: JoyTel,
    private readonly billionConnectService: BillionConnectService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async findAll(query: any) {
    const sims = await paginate('sims', {
      page: query?.page,
      size: query?.size,
      filter: query?.filters,
      sort: query?.sort,
    });
    return sims;
  }

  async findOne(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
    });

    if (!sim) {
      throw new BadRequestException(sim_not_found['ru']);
    }
    return sim;
  }

  async checkBalance(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        coupon: true,
        partner: {
          select: {
            identified_number: true,
          },
        },
      },
    });

    if (!sim) {
      throw new BadRequestException(sim_not_found['ru']);
    }

    let response;

    if (sim.partner.identified_number === PartnerIds.JOYTEL) {
      response = this.joyTelService.getUsage({ coupon: sim.coupon });
    }

    return {
      success: true,
      message: 'Баланс успешно получен!',
      data: response,
    };
  }

  async checkStatus(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        coupon: true,
        partner: {
          select: {
            identified_number: true,
          },
        },
      },
    });

    if (!sim) {
      throw new BadRequestException(sim_not_found['ru']);
    }

    let response;

    if (sim.partner.identified_number === PartnerIds.JOYTEL) {
      response = this.joyTelService.getStatus({ coupon: sim.coupon });
    }

    return {
      success: true,
      data: response,
    };
  }

  async getProfileStatus(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        cid: true,
        partner: {
          select: {
            identified_number: true,
          },
        },
      },
    });

    if (!sim) {
      throw new BadRequestException(sim_not_found['ru']);
    }

    const response = this.joyTelService.getStatus({ coupon: sim.cid });

    return {
      success: true,
      data: response,
    };
  }

  async checkSimStatusOnPartnerSide() {
    this.logger.log('Sim Status on partner side CRON is working!');
    const sims = await this.prisma.sims.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        sim_status: null,
      },
      select: {
        id: true,
        coupon: true,
        partner_id: true,
        channel_order_id: true,
        iccid: true,
      },
    });

    if (!sims || sims.length === 0) {
      this.logger.log('Sims not found for update status');
      return;
    }

    for (let sim of sims) {
      if (sim.partner_id === PartnerIds.JOYTEL) {
        const response = await this.joyTelService.getStatus({ coupon: sim?.coupon });
        console.log('Joytel check status response: ', response);
      }
      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const response = await this.billionConnectService.getStatus({ iccid: sim?.iccid });
        console.log('BC CHECK status cron response: ', response);
      }
    }
    this.logger.info('Finish update partner status in partner side');

    return sims;
  }
}
