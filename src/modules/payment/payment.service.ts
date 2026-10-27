import { BadRequestException, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UpdatePaymentDto } from './dto';
import { PrismaService } from '@prisma';
import { WinstonLoggerService } from '@logger';
import { TBank } from '@http';
import { basket_empty, TBankWebHookResponse } from '@constants';
import { TaxValues } from '@constants';
import { OrderStatus, Status, TransactionStatus } from '@prisma/client';
import { OrderService } from '../order/order.service';
import { GatewayGateway } from '../gateway';
import { PartnerIds } from '@enums';
import { PromoCodeService } from '../promocode';
import { TBANK_VERIFY_WEBHOOK } from '@config';
import { OrderEventsService } from 'src/modules/order-events/order-events.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: WinstonLoggerService,
    private readonly TbankService: TBank,
    private readonly orderService: OrderService,
    private readonly socketGateway: GatewayGateway,
    private readonly promoCodeService: PromoCodeService,
    private readonly orderEvents: OrderEventsService,
  ) {}

  private isCheckingPendingPayments = false;

  async create(userId: number, lang: string) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            is_verified: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            tariff: {
              select: {
                id: true,
                price_sell: true,
                name_ru: true,
              },
            },
          },
        },
      },
    });

    if (!basket) {
      throw new BadRequestException(basket_empty[lang]);
    }

    const totalAmount = basket.items.reduce((sum, item) => {
      const itemPrice = item.price;
      return sum + itemPrice * item.quantity;
    }, 0);

    return {
      success: true,
      message: '',
      data: {
        items: basket?.items?.map((item) => ({
          Name: item?.tariff?.name_ru,
          Price: item?.tariff?.price_sell,
          Quantity: item?.quantity,
          Amount: item?.tariff?.price_sell * item?.quantity,
          Tax: TaxValues.NONE,
        })),
        user: {
          id: basket?.user?.id,
          email: basket?.user?.email,
        },
        order: {
          totalAmount: totalAmount,
        },
      },
    };
  }

  async getPaymentInfos(userId: number, lang: string, promoCode?: string) {
    const basket = await this.prisma.basket.findFirst({
      where: {
        user_id: userId,
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            is_verified: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            tariff_id: true,
            tariff: {
              select: {
                id: true,
                price_sell: true,
                name_ru: true,
                partner_id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!basket || basket.items.length === 0) {
      throw new BadRequestException(basket_empty[lang]);
    }

    const totalAmount = basket.items.reduce((sum, item) => {
      const itemPrice = item.price ?? item.tariff?.price_sell ?? 0;
      return sum + itemPrice * item.quantity;
    }, 0);
    const providers = await this.prisma.partner.findMany({
      where: {
        id: {
          in: [
            ...new Set(
              basket.items.map((item) => item.tariff?.partner_id).filter((id): id is number => id !== undefined),
            ),
          ],
        },
      },
      select: { id: true, identified_number: true },
    });
    for (const item of basket.items) {
      const provider = providers.find((p) => p.id === item.tariff?.partner_id);
      if (
        !item.tariff ||
        item.tariff.status !== Status.ACTIVE ||
        !provider ||
        ![PartnerIds.JOYTEL, PartnerIds.BILLION_CONNECT, PartnerIds.MOBILINE].includes(provider.identified_number!)
      ) {
        throw new BadRequestException('Unsupported or inactive tariff');
      }
    }
    const promo = await this.promoCodeService.validateCodeForPayment(userId, promoCode, totalAmount);
    const discountAmount = promo?.discount_amount ?? 0;
    const finalAmount = totalAmount - discountAmount;
    const receiptItems = this.buildReceiptItems(basket.items, discountAmount, finalAmount);

    // Transaction, Order, SIMlar – bitta basket o‘qishda
    const transaction = await this.prisma.transaction.create({
      data: {
        amount: finalAmount.toString(),
        user_id: basket.user.id,
      },
      select: { id: true },
    });

    const order = await this.prisma.order.create({
      data: {
        transaction_id: transaction.id,
        user_id: basket.user.id,
        status: OrderStatus.CREATED,
      },
      select: { id: true },
    });

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { order_id: order.id },
    });

    await this.orderEvents.record({
      orderId: order.id,
      event: 'order_created',
      message: `Заказ создан из корзины (${basket.items.length} позиций)`,
      meta: { transactionId: transaction.id, totalAmount: finalAmount, discountAmount },
    });

    await this.promoCodeService.createPendingUsage({
      promo,
      userId: basket.user.id,
      transactionId: transaction.id,
      orderId: order.id,
    });

    for (const item of basket.items) {
      if (!item.tariff || item.tariff.status !== Status.ACTIVE) continue;
      const partnerId = item.tariff.partner_id;
      const quantity = item.quantity ?? 1;
      for (let q = 0; q < quantity; q++) {
        await this.prisma.sims.create({
          data: {
            user_id: basket.user.id,
            order_id: order.id,
            partner_id: partnerId,
            tariff_id: item.tariff_id,
            status: OrderStatus.CREATED,
          },
        });
      }
    }

    return {
      data: {
        items: receiptItems,
        user: {
          id: basket?.user.id,
          email: basket.user.email,
        },
        order: {
          id: order.id,
          totalAmount: finalAmount,
          originalAmount: totalAmount,
          discountAmount,
        },
        promo: promo
          ? {
              code: promo.code,
              discount_amount: discountAmount,
              agent_credit_amount: promo.agent_credit_amount,
            }
          : null,
        transaction: {
          transactionId: transaction.id,
        },
      },
    };
  }

  async preparePayment(userId: number, lang: string, promoCode?: string) {
    const { data } = await this.getPaymentInfos(userId, lang, promoCode);
    const paymentPayload = this.buildPaymentPayload(data);

    await this.prisma.transaction.update({
      where: { id: data.transaction.transactionId },
      data: {
        request: JSON.stringify({
          ...paymentPayload,
          promo: data.promo,
          originalAmount: data.order.originalAmount,
          discountAmount: data.order.discountAmount,
        }),
      },
    });

    // Log request/response as structured objects so they are readable in log dashboard
    // this.logger.log({
    //   message: 'REQUEST TO GENERATE PAYMENT URL',
    //   payload: paymentPayload,
    // });

    let response;
    try {
      response = await this.TbankService.initPayment(paymentPayload);
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: {
          status: TransactionStatus.ERROR,
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(data.transaction.transactionId);
      await this.orderEvents.record({
        orderId: data.order.id,
        event: 'payment_link_failed',
        severity: 'error',
        message: error?.message ?? 'Т-Банк не ответил на запрос ссылки на оплату',
      });
      throw error;
    }

    // this.logger.log({
    //   message: 'RESPONSE FROM GENERATE PAYMENT URL',
    //   payload: response,
    // });

    if (response?.Success !== true) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: {
          status: TransactionStatus.ERROR,
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(data.transaction.transactionId);
      await this.orderEvents.record({
        orderId: data.order.id,
        event: 'payment_link_failed',
        severity: 'error',
        message: response?.Details ?? response?.Message ?? 'Т-Банк отклонил запрос ссылки на оплату',
        meta: { errorCode: response?.ErrorCode },
      });
      throw new BadRequestException(response?.Details ? response?.Details : response?.Message);
    }

    // PaymentId приходит уже в ответе на Init — его не нужно ждать из вебхука.
    // Сохраняем сразу: без этого проверочный крон (checkPendingPayments) не
    // может спросить статус у Т-Банка самостоятельно, если их вебхук задержится.
    if (response?.PaymentId) {
      await this.prisma.transaction.update({
        where: { id: data.transaction.transactionId },
        data: { partner_transaction_id: response.PaymentId },
      });
    }

    await this.orderEvents.record({
      orderId: data.order.id,
      event: 'payment_link_created',
      message: 'Ссылка на оплату получена от Т-Банка, ждём клиента',
    });

    return {
      success: true,
      message: '',
      data: {
        payment_url: response?.PaymentURL,
      },
    };
  }

  async acceptTransactionStatus(data: TBankWebHookResponse) {
    this.logger.log('TBANK WEBHOOK RECEIVED', {
      orderId: data?.OrderId,
      paymentId: data?.PaymentId,
      status: data?.Status,
      success: data?.Success,
    });

    // Подпись считаем всегда, но отклоняем только при TBANK_VERIFY_WEBHOOK=true.
    // Пока флаг выключен — копим в логах статистику совпадений на живом трафике:
    // если сразу включить отклонение и алгоритм не сойдётся, платежи встанут молча.
    const signatureValid = this.TbankService.verifyNotification(data as unknown as Record<string, any>);

    if (!signatureValid) {
      const meta = { orderId: data?.OrderId, paymentId: data?.PaymentId };

      if (TBANK_VERIFY_WEBHOOK) {
        this.logger.error('TBANK WEBHOOK REJECTED: invalid signature', meta);
        return 'OK';
      }

      this.logger.warn(
        `TBANK WEBHOOK SIGNATURE MISMATCH (проверка выключена, заказ обработан) | orderId=${meta.orderId} paymentId=${meta.paymentId}`,
      );
    }

    const existTransactionId = Number(data?.OrderId);

    if (!existTransactionId) {
      return 'OK';
    }

    const existTransaction = await this.prisma.transaction.findUnique({
      where: {
        id: existTransactionId,
      },
      select: {
        id: true,
        order_id: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    // const existTransaction = await this.prisma.transaction.findUnique({
    //   where: {
    //     id: Number(data?.OrderId),
    //   },
    //   select: {
    //     id: true,
    //     status: true,
    //     user: {
    //       select: {
    //         id: true,
    //       },
    //     },
    //   },
    // });

    if (!existTransaction) {
      return 'OK';
    }

    // order_id появляется только здесь — поэтому событие о подписи пишем тут,
    // а не в блоке проверки выше, где транзакция ещё не найдена.
    if (!signatureValid && existTransaction.order_id) {
      await this.orderEvents.record({
        orderId: existTransaction.order_id,
        event: 'payment_webhook_signature_mismatch',
        severity: 'warning',
        message: 'Подпись вебхука не совпала, но проверка выключена — заказ обработан как обычно',
        meta: { paymentId: data?.PaymentId },
      });
    }

    // FAILED ham CAS bo‘lishi shart
    if (data.Success === false) {
      const updated = await this.prisma.transaction.updateMany({
        where: {
          id: existTransactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.FAILED,
          partner_transaction_id: data.PaymentId,
          response: JSON.stringify(data),
          updated_at: new Date(),
        },
      });
      await this.promoCodeService.cancelUsageByTransaction(existTransactionId);

      if (existTransaction.order_id && updated.count > 0) {
        await this.orderEvents.record({
          orderId: existTransaction.order_id,
          event: 'payment_failed',
          severity: 'warning',
          message: 'Т-Банк прислал отказ по оплате',
          meta: { status: data.Status, paymentId: data.PaymentId },
        });
      }
      return 'OK';
    }

    if (data.Success === true && data.Status === 'CONFIRMED') {
      // T-Bank acknowledgement provider jarayonini kutmasligi kerak.
      // Payment allaqachon SUCCESS qilib saqlandi; downstream order/provider
      // jarayoni alohida davom etadi, webhook esa darhol HTTP 200 qaytaradi (confirmTransaction ichida).
      await this.confirmTransaction({
        transactionId: existTransactionId,
        orderId: existTransaction.order_id,
        userId: existTransaction.user?.id ?? null,
        paymentId: data.PaymentId,
        rawResponse: data,
        source: 'webhook',
      });
    }

    // if (existTransaction.status === TransactionStatus.SUCCESS) {
    //   return 'OK';
    // }

    // const existOrder = await this.prisma.order.findFirst({
    //   where: {
    //     transaction_id: existTransaction.id,
    //   },
    // });

    // if (existOrder) {
    //   return 'OK';
    // }

    // if (data.Success === true && data.Status === 'CONFIRMED') {
    //   const updatedTransaction = await this.prisma.transaction.update({
    //     where: {
    //       id: existTransaction.id,
    //     },
    //     data: {
    //       status: TransactionStatus.SUCCESS,
    //       partner_transaction_id: data.PaymentId,
    //       response: JSON.stringify(data),
    //       updated_at: new Date(),
    //     },
    //   });
    //   await this.socketGateway.sendPaymentStatus(existTransaction.user.id, { status: updatedTransaction.status });
    //   await this.orderService.create(existTransaction.user.id, updatedTransaction.id);
    // }
    return 'OK';
  }

  /**
   * Атомарно переводит транзакцию PENDING -> SUCCESS и запускает выдачу.
   * Общий путь для двух источников подтверждения: настоящего вебхука
   * Т-Банка и проверочного крона checkPendingPayments (на случай, если
   * вебхук задержался или не пришёл вовсе). updateMany с условием по
   * текущему статусу защищает от двойной обработки, если оба источника
   * сработают почти одновременно — кто первый дошёл до БД, тот и выиграл.
   */
  private async confirmTransaction(params: {
    transactionId: number;
    orderId: number | null;
    userId: number | null;
    paymentId: number;
    rawResponse: any;
    source: 'webhook' | 'poll';
  }): Promise<boolean> {
    const updated = await this.prisma.transaction.updateMany({
      where: {
        id: params.transactionId,
        status: TransactionStatus.PENDING,
      },
      data: {
        status: TransactionStatus.SUCCESS,
        partner_transaction_id: params.paymentId,
        response: JSON.stringify(params.rawResponse),
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      if (params.orderId) {
        await this.orderEvents.record({
          orderId: params.orderId,
          event: params.source === 'poll' ? 'payment_poll_duplicate' : 'payment_webhook_duplicate',
          message:
            params.source === 'poll'
              ? 'Проверка статуса в Т-Банке нашла уже обработанную оплату — пропущено'
              : 'Повторный вебхук Т-Банка по уже обработанной оплате — пропущен',
          meta: { paymentId: params.paymentId },
        });
      }
      return false;
    }

    if (params.orderId) {
      await this.orderEvents.record({
        orderId: params.orderId,
        event: 'payment_confirmed',
        message:
          params.source === 'poll'
            ? 'Оплата подтверждена проверкой статуса в Т-Банке — вебхук не пришёл вовремя'
            : 'Оплата подтверждена Т-Банком',
        meta: { paymentId: params.paymentId, source: params.source },
      });
    }

    if (params.userId) {
      void this.processConfirmedPayment(params.userId, params.transactionId);
    }

    return true;
  }

  /**
   * Подстраховка на случай, когда вебхук Т-Банка задерживается или теряется:
   * сами спрашиваем статус оплаты вместо того, чтобы пассивно ждать колбэк.
   * PaymentId уже сохранён на шаге preparePayment (сразу из ответа Init, не
   * из вебхука) — поэтому спросить можно даже если вебхук так и не пришёл.
   *
   * Трогает только CONFIRMED: если статус не подтверждён, транзакция просто
   * остаётся PENDING — дальше ей занимается существующий крон очистки
   * брошенных заказов (24ч), а не этот метод. Список финальных статусов
   * отказа у Т-Банка нигде в проекте не задокументирован, и гадать здесь
   * опаснее, чем оставить платёж висеть лишний час.
   */
  @Cron('*/5 * * * *')
  async checkPendingPayments() {
    if (this.isCheckingPendingPayments) return { checked: 0, confirmed: 0 };
    this.isCheckingPendingPayments = true;

    try {
      return await this.checkPendingPaymentsOnce();
    } finally {
      this.isCheckingPendingPayments = false;
    }
  }

  private async checkPendingPaymentsOnce() {
    const STALE_AFTER_MS = 3 * 60 * 1000;
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);

    const pending = await this.prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        partner_transaction_id: { not: null },
        created_at: { lt: cutoff },
      },
      select: {
        id: true,
        order_id: true,
        partner_transaction_id: true,
        user: { select: { id: true } },
      },
      take: 20,
      orderBy: { created_at: 'asc' },
    });

    if (pending.length === 0) return { checked: 0, confirmed: 0 };

    let confirmed = 0;

    for (const transaction of pending) {
      try {
        const status = await this.TbankService.getPaymentStatus(Number(transaction.partner_transaction_id));

        if (status?.Success === true && status?.Status === 'CONFIRMED') {
          const applied = await this.confirmTransaction({
            transactionId: transaction.id,
            orderId: transaction.order_id,
            userId: transaction.user?.id ?? null,
            paymentId: Number(transaction.partner_transaction_id),
            rawResponse: status,
            source: 'poll',
          });
          if (applied) confirmed += 1;
        }
      } catch (error) {
        this.logger.error(`checkPendingPayments: не удалось проверить transaction ${transaction.id}`, error);
      }
    }

    this.logger.log(`checkPendingPayments: проверено ${pending.length}, подтверждено ${confirmed}`);
    return { checked: pending.length, confirmed };
  }

  private async processConfirmedPayment(userId: number, transactionId: number) {
    try {
      await this.promoCodeService.confirmUsageByTransaction(transactionId);
    } catch (error) {
      this.logger.error(`Promo confirmation failed for transaction ${transactionId}`, error);
    }

    try {
      await this.socketGateway.sendPaymentStatus(userId, {
        status: TransactionStatus.SUCCESS,
      });
    } catch (error) {
      this.logger.error(`Payment socket notification failed for transaction ${transactionId}`, error);
    }

    try {
      await this.orderService.create(userId, transactionId);
    } catch (error) {
      this.logger.error(`Order processing failed for confirmed transaction ${transactionId}`, error);
    }
  }

  async acceptPaymentTest(id: number, data: any) {
    const response = await this.TbankService.initPayment(data);
    console.log(response);

    return response;
  }

  update(id: number, data: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }

  private buildReceiptItems(items: any[], discountAmount: number, finalAmount: number) {
    if (discountAmount > 0) {
      return [
        {
          Name: 'Услуга доступа к интернету eSIM',
          Price: finalAmount,
          Quantity: 1,
          Amount: finalAmount,
          Tax: TaxValues.NONE,
        },
      ];
    }

    return items.map((item) => {
      const price = item.price ?? item?.tariff?.price_sell ?? 0;
      return {
        Name: `Услуга доступа к интернету ${item?.tariff?.name_ru}`,
        Price: price,
        Quantity: item?.quantity,
        Amount: price * item?.quantity,
        Tax: TaxValues.NONE,
      };
    });
  }

  private buildPaymentPayload(data: any) {
    const email = data?.user?.email;

    if (!email) {
      throw new BadRequestException('Не указан email пользователя для формирования чека');
    }

    return {
      Amount: data?.order?.totalAmount,
      OrderId: data?.transaction.transactionId,
      Description: `Оплата eSIM-карты на ${data?.order?.totalAmount / 100}`,
      Receipt: {
        Email: email,
        Taxation: 'usn_income_outcome',
        Items: data?.items,
      },
    };
  }
}
