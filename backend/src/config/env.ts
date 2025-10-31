// backend/src/config/env.ts

import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Server & CORS
    PORT: z.string().default('4000'),
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required.'), 

    // JWT/Security
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars.'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars.'),

    // PostgreSQL Database
    PG_HOST: z.string(),
    PG_PORT: z.string().transform(Number).default('5432'),
    PG_USER: z.string(),
    PG_PASSWORD: z.string(),
    PG_DATABASE: z.string(),

    // Email (Optional)
    EMAIL_HOST: z.string().optional(),
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Lỗi biến môi trường:", _env.error.format());
    throw new Error("Một số biến môi trường bắt buộc chưa được định nghĩa hoặc sai kiểu dữ liệu.");
}

export const env = _env.data;

export const E2EE_CONSTANTS = {
    AES_GCM_ALGORITHM: "AES-GCM",
    AES_GCM_KEY_SIZE: 256,
    AES_GCM_IV_LENGTH: 12,
};
