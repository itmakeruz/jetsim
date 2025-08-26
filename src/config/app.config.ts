import { config } from './validate.config';

// app
const APP_PORT = config.get<string>('APP_PORT') ?? 1722;

//database
const DATABASE_URL = config.get<string>('DATABASE_URL') ?? '';

//jwt
const JWT_ACCESS_SECRET = config.get<string>('JWT_ACCESS_SECRET') ?? '';
const JWT_REFRESH_SECRET = config.get<string>('JWT_REFRESH_SECRET') ?? '';
const JWT_ACCESS_EXPIRE_TIME = config.get<string>('JWT_ACCESS_EXPIRE_TIME') ?? '15m';
const JWT_REFRESH_EXPIRE_TIME = config.get<string>('JWT_REFRESH_EXPIRE_TIME') ?? '7d';

//joytel
const JOYTEL_URL = config.get<string>('JOYTEL_URL') ?? '';
const JOYTEL_APP_ID = config.get<string>('JOYTEL_APP_ID') ?? '';
const JOYTEL_APP_SECRET = config.get<string>('JOYTEL_APP_SECRET') ?? '';
const JOYTEL_CUSTOMER_CODE = config.get<string>('JOYTEL_CUSTOMER_ID') ?? '';
const JOYTEL_CUSTOMER_AUTH = config.get<string>('JOYTEL_CUSTOMER_AUTH') ?? '';
const JOY_TEL_ORDER_URL = config.get<string>('JOY_TEL_ORDER_URL') ?? '';

//billion connect
const BILLION_CONNECT_URL = config.get<string>('BILLION_CONNECT_URL') ?? '';
const BILLION_CONNECT_APP_SECRET = config.get<string>('BILLION_CONNECT_APP_SECRET') ?? '';
const BILLION_CONNECT_APP_KEY = config.get<string>('BILLION_CONNECT_APP_KEY') ?? '';
const BILLION_CONNECT_SIGN_METHOD = config.get<string>('BILLION_CONNECT_SIGN_METHOD') ?? '';


const ROLES_DECORATOR_KEY = config.get<string>('ROLES_DECORATOR_KEY') ?? '';

//export
export {
  APP_PORT,
  DATABASE_URL,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRE_TIME,
  JWT_REFRESH_EXPIRE_TIME,
  JOYTEL_URL,
  JOY_TEL_ORDER_URL,
  JOYTEL_APP_ID,
  JOYTEL_APP_SECRET,
  JOYTEL_CUSTOMER_CODE,
  JOYTEL_CUSTOMER_AUTH,
  BILLION_CONNECT_URL,
  BILLION_CONNECT_APP_SECRET,
  BILLION_CONNECT_SIGN_METHOD,
  BILLION_CONNECT_APP_KEY,
  ROLES_DECORATOR_KEY,
};
