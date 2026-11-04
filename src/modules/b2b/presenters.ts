import { Reseller, ResellerLedger, ResellerOrder, ResellerOrderState } from '@prisma/client';
import { Balance } from './ledger/reseller-ledger.service';
import { toNumber } from './ledger/money';

export function presentBalance(b: Balance, currency: string) {
  return {
    balance_kopecks: toNumber(b.balance),
    reserved_kopecks: toNumber(b.reserved),
    available_kopecks: toNumber(b.available),
    currency,
  };
}

export function presentReseller(r: Reseller, balance?: Balance) {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    currency: r.currency,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ...(balance ? { balance: presentBalance(balance, r.currency) } : {}),
  };
}

export function presentLedgerEntry(e: ResellerLedger & { order?: { client_order_id: string } | null }) {
  return {
    id: e.id,
    type: e.type,
    delta_balance_kopecks: toNumber(e.delta_balance_kopecks),
    delta_reserved_kopecks: toNumber(e.delta_reserved_kopecks),
    balance_after_kopecks: toNumber(e.balance_after),
    reserved_after_kopecks: toNumber(e.reserved_after),
    order_id: e.reseller_order_id,
    client_order_id: e.order?.client_order_id ?? null,
    comment: e.comment,
    actor: e.actor,
    created_at: e.created_at,
  };
}

/**
 * Состояния, которые видит партнёр. Внутренние различия (SUBMITTING/SUBMITTED/RECONCILE) —
 * наша кухня; для партнёра заказ либо «в работе», либо выдан, либо завершился неудачей.
 */
export type PartnerOrderStatus = 'PROCESSING' | 'ISSUED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export function partnerStatus(state: ResellerOrderState): PartnerOrderStatus {
  switch (state) {
    case 'ISSUED':
      return 'ISSUED';
    case 'FAILED':
      return 'FAILED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'REFUNDED':
      return 'REFUNDED';
    default:
      return 'PROCESSING';
  }
}

/** Заказ глазами партнёра: без поставщиков, сырых ответов, внутренних состояний и закупочной стоимости JetSim. */
export function presentPartnerOrder(o: ResellerOrder) {
  return {
    id: o.id,
    client_order_id: o.client_order_id,
    status: partnerStatus(o.state),
    tariff: {
      id: o.tariff_id,
      name_ru: o.tariff_name_ru,
      name_en: o.tariff_name_en,
      data_gb: o.data_gb,
      validity_days: o.validity_days,
    },
    price_kopecks: toNumber(o.price_kopecks),
    price_version: o.price_version,
    currency: o.currency,
    source: o.source,
    created_at: o.created_at,
    updated_at: o.updated_at,
    issued_at: o.issued_at,
    failed_at: o.failed_at,
  };
}

/** Заказ глазами суперадмина: плюс внутреннее состояние, причина и служебный ответ поставщика. */
export function presentAdminOrder(o: ResellerOrder & { reseller?: { name: string } | null }) {
  return {
    ...presentPartnerOrder(o),
    reseller_id: o.reseller_id,
    reseller_name: o.reseller?.name ?? null,
    state: o.state,
    state_reason: o.state_reason,
    source_ref: o.source_ref,
    provider_response: o.provider_response,
    sim_id: null as number | null, // заполняется там, где подгружена связь
    submitting_at: o.submitting_at,
    submitted_at: o.submitted_at,
  };
}
