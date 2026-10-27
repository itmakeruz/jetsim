import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MobilineService {
  buildActivation(simId: number, sku: string, days: number) {
    const groupId = process.env.MOBILINE_GROUP_ID;
    if (!groupId || !process.env.MOBILINE_GROUP_KEY || !process.env.MOBILINE_BASE_URI) {
      throw new ServiceUnavailableException('Mobiline is not configured');
    }
    if (!sku || !Number.isInteger(days) || days <= 0) throw new Error('Invalid Mobiline tariff');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
    const date = `${part('year')}-${part('month')}-${part('day')}`;
    return {
      group_id: groupId,
      product_id: sku,
      channel_order_id: `${groupId}${date.replace(/-/g, '')}${part('hour')}${part('minute')}${part('second')}${String(simId).padStart(6, '0')}`,
      days,
      quantity: 1,
      activation_date: date,
    };
  }

  async activate(payload: ReturnType<MobilineService['buildActivation']>) {
    const response = await axios.post(
      `${process.env.MOBILINE_BASE_URI!.replace(/\/$/, '')}/api/${encodeURIComponent(payload.group_id)}/common/activation/activation_request`,
      payload,
      {
        timeout: 60000,
        validateStatus: () => true,
        headers: { 'group-id': payload.group_id, 'group-key': process.env.MOBILINE_GROUP_KEY },
      },
    );
    if (
      !response.data ||
      typeof response.data !== 'object' ||
      !['string', 'number'].includes(typeof response.data.ret) ||
      String(response.data.ret).trim() === '' ||
      (response.status >= 400 && String(response.data.ret) === '0')
    ) {
      throw new Error('Mobiline returned an invalid response; activation outcome is unknown');
    }
    return response.data;
  }
}
