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
