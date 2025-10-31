// backend/src/app.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import { env } from './config/env';
import securityMiddleware from './middlewares/security';
import authRoutes from './modules/auth/auth.routes';
import chatRoutes from './modules/chat/chat.routes';

const app: Application = express();

// --- ✅ BẮT BUỘC: Cho phép Express parse JSON ---
app.use(express.json());

// --- ✅ BỔ SUNG: Cho phép gửi form-urlencoded (tùy chọn) ---
app.use(express.urlencoded({ extended: true }));

// --- 1. MIDDLEWARES BẢO MẬT & CƠ BẢN ---
securityMiddleware(app);

// --- 2. ROUTES ---
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'Chat E2EE Backend',
    port: env.PORT,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes); // 👈 để sau express.json()

// --- 3. XỬ LÝ LỖI TOÀN CỤC ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`❌ Global Error Handler: ${err.message}`, err);

  if (err.message.includes('User already exists')) {
    return res.status(409).json({ message: 'Conflict: Email or username already taken.' });
  }

  return res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
  });
});

export default app;
