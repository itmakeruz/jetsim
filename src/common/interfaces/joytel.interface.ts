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
