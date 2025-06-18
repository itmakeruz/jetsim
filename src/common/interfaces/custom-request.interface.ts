import { Request } from 'express';

export interface IUser {
  id: number;
  username: string;
  role: string;
}

export class IRequest extends Request {
  user: IUser;
  kiosk: any;
}
