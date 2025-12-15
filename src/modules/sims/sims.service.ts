import { PartnerIds } from '@enums';
import { paginate } from '@helpers';
import { BillionConnectService, HttpService, JoyTel } from '@http';
import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma';
import { FilePath, sim_not_found } from '@constants';
import { OrderStatus, SimStatus } from '@prisma/client';
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

    let responses;

    for (let sim of sims) {
      // if (sim.partner_id === PartnerIds.JOYTEL) {
      //   const response = await this.joyTelService.getStatus({ coupon: sim?.coupon });
      //   console.log(response);

      //   responses.push(response);
      //   console.log('Joytel check status response: ', response);
      // }
      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const response = await this.billionConnectService.getStatus({ iccid: sim?.iccid });
        console.log(response);

        const esimStatus = response.tradeData?.find((el) => {
          el?.status === 2;
        });
        await this.prisma.sims.update({
          where: {
            id: sim?.id,
          },
          data: {
            sim_status: esimStatus ? SimStatus.ACTIVATED : null,
          },
        });
        console.log('BC CHECK status cron response: ', response);
      }
    }
    this.logger.info('Finish update partner status in partner side');

    return {
      sims: sims,
      data: responses,
    };
  }

  async staticSims(userId: number, lang: string) {
    const sims = await paginate('sims', {
      // page: query?.page,
      // size: query?.size,
      // filter: query?.filters,
      // sort: query?.sort,
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        order_id: true,
        created_at: true,
        tariff: {
          select: {
            id: true,
            is_4g: true,
            is_5g: true,
            name_ru: true,
            name_en: true,
            quantity_internet: true,
            validity_period: true,
            region_group: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
            regions: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'success',
      ...sims,
      data: sims?.data?.map((sim: any) => {
        return {
          id: sim?.id,
          order_id: sim?.order_id,
          tariff_id: sim?.tariff?.id,
          tariff_name: sim?.tariff?.[`name_${lang}`],
          usage: 300,
          day_left: 10,
          is_4g: sim?.tariff?.is_4g,
          is_5g: sim?.tariff?.is_5g,
          region_group: {
            id: sim?.tariff?.region_group?.id,
            name: sim?.tariff?.region_group?.[`name_${lang}`],
            image: `${FilePath.REGION_GROUP_ICON}/${sim?.tariff?.region_group?.image}`,
          },
          regions: sim?.tariff?.regions?.map((region: any) => ({
            id: region?.id,
            name: region?.[`name_${lang}`],
            image: `${FilePath.REGION_ICON}/${region?.image}`,
          })),
        };
      }),
    };
  }

  async activatedStaticSims(userId: number, lang: string) {
    const sims = await paginate('sims', {
      where: {
        user_id: userId,
        sim_status: SimStatus.ACTIVATED,
      },
      select: {
        id: true,
        order_id: true,
        status: true,
        created_at: true,
        tariff: {
          select: {
            id: true,
            is_4g: true,
            is_5g: true,
            name_ru: true,
            name_en: true,
            quantity_internet: true,
            validity_period: true,
            region_group: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
            regions: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'success',
      ...sims,
      data: sims?.data?.map((sim: any) => {
        return {
          id: sim?.id,
          order_id: sim?.order_id,
          tariff_id: sim?.tariff?.id,
          tariff_name: sim?.tariff?.[`name_${lang}`],
          status: sim?.status,
          usage: 300,
          day_left: 10,
          is_4g: sim?.tariff?.is_4g,
          is_5g: sim?.tariff?.is_5g,
          region_group: {
            id: sim?.tariff?.region_group?.id,
            name: sim?.tariff?.region_group?.[`name_${lang}`],
            image: `${FilePath.REGION_GROUP_ICON}/${sim?.tariff?.region_group?.image}`,
          },
          regions: sim?.tariff?.regions?.map((region: any) => ({
            id: region?.id,
            name: region?.[`name_${lang}`],
            image: `${FilePath.REGION_ICON}/${region?.image}`,
          })),
        };
      }),
    };
  }

  async getActiveSimsStatic(userId: number, lang: string) {
    setImmediate(async () => {
      await this.updateStatus(userId);
    });
    const sims = await paginate('sims', {
      where: {
        user_id: userId,
        sim_status: null,
      },
      select: {
        id: true,
        order_id: true,
        iccid: true,
        uid: true,
        pin_1: true,
        pin_2: true,
        puk_1: true,
        puk_2: true,
        qrcode: true,
        status: true,
        tariff: {
          select: {
            id: true,
            name_ru: true,
            name_en: true,
            quantity_internet: true,
            validity_period: true,
            is_4g: true,
            is_5g: true,
            region_group: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
            regions: {
              select: {
                id: true,
                name_ru: true,
                name_en: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: '',
      data: sims?.data?.map((sim: any) => {
        return {
          id: sim?.id,
          order_id: sim?.order_id,
          tariff_id: sim?.tariff?.id,
          tariff_name: sim?.tariff?.[`name_${lang}`],
          status: sim?.status,
          usage: sim?.tariff?.quantity_internet,
          day_left: sim?.tariff?.validity_period,
          is_4g: sim?.tariff?.is_4g,
          is_5g: sim?.tariff?.is_5g,
          qr_code: `${FilePath.QR_CODE_IMAGES}/qr_content_${sim?.id}.png`,
          pin_1: sim?.pin_1,
          pin_2: sim?.pin_2,
          puk_1: sim?.puk_1,
          puk_2: sim?.puk_2,
          iccid: sim?.iccid,
          can_activate: sim.status === OrderStatus.NOTIFY_COUPON ? true : false,
          uid: sim?.uid,
          region_group: {
            id: sim?.tariff?.region_group?.id,
            name: sim?.tariff?.region_group?.[`name_${lang}`],
            image: `${FilePath.REGION_GROUP_ICON}/${sim?.tariff?.region_group?.image}`,
          },
          regions: sim?.tariff?.regions?.map((region: any) => ({
            id: region?.id,
            name: region?.[`name_${lang}`],
            image: `${FilePath.REGION_ICON}/${region?.image}`,
          })),
        };
      }),
    };
  }

  async updateStatus(userId: number) {
    const sims = await this.prisma.sims.findMany({
      where: {
        user_id: userId,
        status: {
          notIn: ['FAILED', 'PENDING', 'NOTIFY_COUPON', 'REDEEM_COUPON'],
        },
      },
      select: {
        id: true,
        coupon: true,
        iccid: true,
        partner_id: true,
      },
    });

    for (let sim of sims) {
      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const partnerStatus = await this.billionConnectService.getStatus({ iccid: sim.iccid });

        const tradeData = partnerStatus?.tradeData ?? null;

        if (Array.isArray(tradeData)) {
          const hasActivatedStatus = tradeData.some((el: any) => el.status === 2);

          if (hasActivatedStatus) {
            await this.prisma.sims.update({
              where: { id: sim.id },
              data: { sim_status: 'ACTIVATED' },
            });
          }
        }
      }
    }
  }

  async getUsage(userId: number) {
    const sims = await this.prisma.sims.findMany({
      where: {
        user_id: userId,
        sim_status: 'ACTIVATED',
        status: 'COMPLETED',
      },
      select: {
        id: true,
        coupon: true,
        iccid: true,
        status: true,
        partner_id: true,
        partner_order_id: true,
      },
    });
    console.log(sims);
    const responses: any = [];

    for (let sim of sims) {
      if (sim.partner_id === PartnerIds.BILLION_CONNECT) {
        const response = await this.billionConnectService.getUsage({
          iccid: sim.iccid,
          orderId: sim?.partner_order_id,
        });
        console.log(response);
        responses.push(response);
        const tradeData = response?.tradeData ?? null;

        if (Array.isArray(tradeData) && response?.tradeCode === '1000') {
          const usage = response.subOrderList[0].usageInfoList?.reduce(
            (acc: number, infoList: { usedDate: string; usageAmt: string }) => {
              acc += Number(infoList.usedDate);
            },
            0,
          );

          console.log(usage);

          await this.prisma.sims.update({
            where: {
              id: sim.id,
            },
            data: {
              last_usage_quantity: usage.toString(),
            },
          });
        }
      }
    }
    return responses;
  }
}
