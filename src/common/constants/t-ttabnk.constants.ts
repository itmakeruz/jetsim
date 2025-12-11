export enum TaxValues {
  NONE = 'none',
}

export interface TBankInitRequest {
  Amount: number;
  OrderId: string;
  Description: string;
  Receipt: {
    Email: string;
    Taxation: string;
    Items: Items[];
  };
}

export interface Items {
  Name: string;
  Price: number;
  Quantity: number;
  Amount: number;
  Tax: string;
}

export interface TBankWebHookResponse {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: string;
  PaymentId: number;
  ErrorCode: string;
  Amount: number;
  CardId: number;
  Pan: string;
  ExpDate: string;
  Token: ['REDACTED'];
}
