import { Request } from 'express';

export interface IUser {
  id: number;
  email?: string;
  login?: string;
  type?: 'user' | 'staff';
  role?: string;
  roles?: string[];
}

export class IRequest extends Request {
  user: IUser;
  kiosk: any;
}
