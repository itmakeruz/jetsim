export interface JoyTelEsimOrderResponse {
  message: string;
  code: number;
  data: {
    orderTid: string;
    orderCoder: string;
  };
}
