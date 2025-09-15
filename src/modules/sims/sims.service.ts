import { PartnerIds } from '@enums';
import { paginate } from '@helpers';
import { HttpService, JoyTel } from '@http';
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';

@Injectable()
export class SimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly joyTelService: JoyTel,
  ) {}

  async findAll(query: any) {
    const sims = await paginate('sims', query);
    return sims;
  }

  async findOne(id: number) {
    const sim = await this.prisma.sims.findUnique({
      where: {
        id: id,
      },
    });

    if (!sim) {
      throw new BadRequestException('Esim с таким ID не существует!');
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
      throw new BadRequestException('Esim с таким ID не существует!');
    }

    let response;

    if (sim.partner.identified_number === PartnerIds.JOYTEL) {
      response = this.joyTelService.getUsage({ coupon: sim.coupon });
    }

    return {
      status: HttpStatus.OK,
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
      throw new BadRequestException('Esim с таким ID не существует!');
    }

    let response;

    if (sim.partner.identified_number === PartnerIds.JOYTEL) {
      response = this.joyTelService.getStatus({ coupon: sim.coupon });
    }

    return {
      status: HttpStatus.OK,
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
      throw new BadRequestException('Esim с таким ID не существует!');
    }

    const response = this.joyTelService.getStatus({ coupon: sim.cid });

    return {
      status: HttpStatus.OK,
      data: response,
    };
  }
}
