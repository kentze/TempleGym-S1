import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL:       z.string().min(1),
  JWT_SECRET:         z.string().min(16),
  JWT_EXPIRES_IN:     z.string().default('7d'),
  SMTP_HOST:          z.string().min(1),
  SMTP_PORT:          z.coerce.number(),
  SMTP_USER:          z.string().min(1),
  SMTP_PASS:          z.string().min(1),
  SMTP_FROM:          z.string().min(1),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  GYM_LAT:            z.coerce.number(),
  GYM_LNG:            z.coerce.number(),
  GYM_RADIUS_M:       z.coerce.number().default(100), //500 might be too large, the distance between the gym and campus is only 200 meters
  PORT:               z.coerce.number().default(3000),
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  DEMO_EMAILS:        z.string().optional(), // comma-separated list of demo accounts that skip OTP email
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
