import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '@prisma';

/**
 * Интеграционные тесты B2B гоняются на настоящем Postgres (миграции, CHECK, триггер
 * неизменяемости журнала, блокировки). Без B2B_TEST_DATABASE_URL они пропускаются,
 * чтобы обычный `npm test` не требовал БД.
 */
export const TEST_DB_URL = process.env.B2B_TEST_DATABASE_URL;
export const describeDb: typeof describe = TEST_DB_URL ? describe : (describe.skip as typeof describe);

export function createTestPrisma(): PrismaService {
  if (!TEST_DB_URL) throw new Error('B2B_TEST_DATABASE_URL is not set');
  // Страховка: TRUNCATE ... CASCADE ниже сносит данные — только в тестовую базу
  if (!/_test(\?|$)/.test(TEST_DB_URL)) throw new Error('B2B_TEST_DATABASE_URL must point to a *_test database');
  return new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } }) as unknown as PrismaService;
}

export async function resetB2bTables(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE reseller_ledger, reseller_account, reseller_api_key, reseller_tariff, reseller_order, reseller,
              order_events, sims, "order", transaction, "user", tariff, partner RESTART IDENTITY CASCADE`,
  );
}

export async function seedPartner(prisma: PrismaService, identifiedNumber = 1) {
  return prisma.partner.create({
    data: { name_ru: `P${identifiedNumber}`, name_en: `P${identifiedNumber}`, status: 'ACTIVE', identified_number: identifiedNumber },
  });
}

export async function seedTariff(prisma: PrismaService, partnerId: number, over: Record<string, unknown> = {}) {
  return prisma.tariff.create({
    data: {
      name_ru: 'Тариф 5 ГБ',
      name_en: 'Plan 5 GB',
      status: 'ACTIVE',
      partner_id: partnerId,
      sku_id: 'SKU-1',
      quantity_internet: 5,
      validity_period: 30,
      ...over,
    } as any,
  });
}

/** Компания со служебным пользователем и счётом; balance — копейки. */
export async function seedReseller(prisma: PrismaService, name: string, balance = 0n) {
  const user = await prisma.user.create({ data: { name, is_service: true, is_verified: true } });
  const reseller = await prisma.reseller.create({
    data: {
      name,
      service_user_id: user.id,
      account: { create: { balance_kopecks: balance } },
    },
  });
  return reseller;
}

/** Минимальная строка ResellerOrder — нужна, чтобы проводки журнала ссылались на заказ. */
export async function seedResellerOrder(
  prisma: PrismaService,
  p: { resellerId: number; tariffId: number; clientOrderId: string; price: bigint; state?: any },
) {
  return prisma.resellerOrder.create({
    data: {
      reseller_id: p.resellerId,
      client_order_id: p.clientOrderId,
      request_hash: 'h-' + p.clientOrderId,
      tariff_id: p.tariffId,
      tariff_name_ru: 'Тариф',
      tariff_name_en: 'Plan',
      price_kopecks: p.price,
      price_version: 1,
      state: p.state ?? 'RESERVED',
    },
  });
}
