export interface JoyTelCallbackResponse {
  orderCode: string;
  orderTid: string;
  phone: string;
  outboundCode: string;
  receiveName: string;
  email: string;
  status: number;
  itemList: itemList[];
}

interface itemList {
  productName: string;
  quantity: number;
  snList: snList[];
  productCode: string;
}

interface snList {
  snCode: string;
  snPin: string;
  snPuk: string;
  productExpireDate: string;
}

export interface CreateOrderResponseJoyTel {
  message: string;
  code: number;
  data: {
    orderTid: string;
    orderCode: string;
  };
}

/**
 * Ответ эндпоинта /customerApi/customerOrder/query — синхронный опрос
 * статуса заказа тем же методом, что и в колбэке orderTid/orderCode,
 * но под оберткой data (в отличие от «плоского» JoyTelCallbackResponse,
 * который JoyTel присылает сам, без этой обёртки).
 */
export interface QueryOrderResponseJoyTel {
  code: number;
  message?: string;
  data?: {
    orderTid: string;
    orderCode: string;
    itemList?: {
      productName?: string;
      quantity?: number;
      productCode?: string;
      snList?: { snCode: string; snPin: string; snPuk?: string; productExpireDate?: string }[];
    }[];
  };
}

export interface NotifyResponseJoyTel {
  transId: string;
  resultCode: string;
  resultMsg: string;
  finishTime: string;
  data: {
    coupon: string;
    qrcodeType: number;
    qrcode: string;
    cid: string;
    salePlanName: string;
    salePlanDays: number;
    pin1: string;
    pin2: string;
    puk1: string;
    puk2: string;
  };
}

export interface CouponRequest {
  coupon: string;
}

export interface CidRequest {
  cid: string;
}
