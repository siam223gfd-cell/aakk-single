import dotenv from 'dotenv';

dotenv.config();

function resolveServerPort(): number {
  const argIdx = process.argv.findIndex((arg) => arg === '--port' || arg.startsWith('--port='));
  if (argIdx !== -1) {
    const raw = process.argv[argIdx].includes('=')
      ? process.argv[argIdx].split('=')[1]
      : process.argv[argIdx + 1];
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const envPort = Number(process.env.PORT || 0);
  const nginxPort = Number(process.env.NGINX_PORT || 0);
  if (envPort > 0 && (!nginxPort || envPort !== nginxPort)) {
    return envPort;
  }

  return Number(process.env.DEFAULT_APP_PORT || 3000);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: resolveServerPort(),
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  CLIENT_URL: process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  INITIAL_SUPER_ADMIN_EMAIL: process.env.INITIAL_SUPER_ADMIN_EMAIL || '',
  INITIAL_SUPER_ADMIN_PASSWORD: process.env.INITIAL_SUPER_ADMIN_PASSWORD || '',
  INITIAL_SUPER_ADMIN_NAME: process.env.INITIAL_SUPER_ADMIN_NAME || 'NOVARA Super Admin',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'NOVARA COMMERCE <no-reply@novara.com.bd>',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'sslcommerz',
  PAYMENT_STORE_ID: process.env.PAYMENT_STORE_ID || '',
  PAYMENT_STORE_PASSWORD: process.env.PAYMENT_STORE_PASSWORD || '',
  PAYMENT_SANDBOX: process.env.PAYMENT_SANDBOX !== 'false',
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || '',
};

export const integrations = {
  mongodb: Boolean(env.MONGODB_URI && env.MONGODB_URI.startsWith('mongodb')),
  cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  resend: Boolean(env.RESEND_API_KEY),
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  facebookOAuth: Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
  paymentGateway: Boolean(env.PAYMENT_STORE_ID && env.PAYMENT_STORE_PASSWORD),
};

export function getJwtSecret(): string {
  if (env.JWT_SECRET && env.JWT_SECRET.length >= 16) {
    return env.JWT_SECRET;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production environment.');
  }
  return 'novara-dev-ephemeral-jwt-secret-change-in-production';
}
