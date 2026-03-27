import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const TURSO_DATABASE_URL =
  process.env.TURSO_DATABASE_URL ||
  (process.env.NODE_ENV !== 'production' ? 'file:./data/local.db' : null);
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
export const REDIS_URL_RAW = process.env.REDIS_URL || '';
export const REDIS_DISABLED =
  ['disable', 'none', 'off'].includes(REDIS_URL_RAW.trim().toLowerCase()) ||
  (NODE_ENV !== 'production' && REDIS_URL_RAW === '');
export const REDIS_URL = REDIS_DISABLED ? 'redis://localhost:6379' : REDIS_URL_RAW;

if (NODE_ENV === 'production' && !REDIS_URL_RAW) {
  throw new Error('REDIS_URL is required in production');
}
export const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== 'production'
    ? 'dev-only-jwt-secret-min-32-characters-long-change-me'
    : null);
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
export const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
export const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
export const META_BUSINESS_ACCOUNT_ID = process.env.META_BUSINESS_ACCOUNT_ID;
export const META_API_VERSION = process.env.META_API_VERSION || 'v19.0';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required in production');
  }
  if (!process.env.REDIS_URL || REDIS_DISABLED) {
    throw new Error('REDIS_URL must point to a real Redis server in production');
  }
}
