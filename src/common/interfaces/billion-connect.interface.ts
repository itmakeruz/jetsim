export interface CrerateOrderResponseBillionConnect {
  tradeCode: string;
  tradeMsg: string;
  tradeData: CreateOrderTradeData[];
}

interface CreateOrderTradeData {
  orderId: string;
  channelOrderId: string;
  subOrderList: CreateOrderSubOrderList[];
}

interface CreateOrderSubOrderList {
  subOrderId: string;
  channelSubOrderId: string;
}

export interface BillionConnectCraeteOrderResponse {
  tradeCode: string;
  tradeMsg: string;
  tradeData: {
    channelOrderId: string;
    orderId: string;
    subOrderList: {
      channelSubOrderId: string;
      subOrderId: string;
    };
  };
}

export interface BillionConnectCallbackResponse {
  tradeType: string;
  tradeTime: string;
  tradeData: {
    channelOrderId: string;
    orderId: string;
    subOrderList: {
      [key: string]: {
        uid: string;
        iccid: string;
        subOrderId: string;
        pin: string;
        puk: string;
        validTime: string;
        rechargeableESIM: number;
        channelSubOrderId: string;
        msisdn: string;
        qrCodeContent: string;
        apn: string;
      };
    };
  };
}
