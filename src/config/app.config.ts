import { config } from './validate.config';

const APP_PORT = config.get<string>('APP_PORT');
const DATABASE_URL = config.get<string>('DATABASE_URL') ?? '';
const JWT_ACCESS_SECRET = config.get<string>('JWT_ACCESS_SECRET') ?? '';
const JWT_REFRESH_SECRET = config.get<string>('JWT_REFRESH_SECRET') ?? '';

export { APP_PORT, DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET };
