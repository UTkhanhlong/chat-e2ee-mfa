// backend/src/middlewares/security.ts

import { env } from '../config/env'; // 💡 Đường dẫn tương đối
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
});

const corsOptions = {
    origin: env.CORS_ORIGINS.split(','), 
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

const securityMiddleware = (app: express.Application) => {
    
    app.use(helmet()); 
    app.use(cors(corsOptions)); 
    app.use(express.json({ limit: '10kb' })); 
    app.use(limiter); 
    
    console.log('✅ Security middlewares loaded (Helmet, CORS, Rate Limit).');
};

export default securityMiddleware;
