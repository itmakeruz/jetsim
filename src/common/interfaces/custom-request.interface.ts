import { Request } from 'express';

export interface IUser {
  id: number;
  email: string;
}

export class IRequest extends Request {
  user: IUser;
  kiosk: any;
}
