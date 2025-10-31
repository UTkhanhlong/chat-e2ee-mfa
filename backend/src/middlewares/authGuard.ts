// backend/src/middlewares/authGuard.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

// Kiểu mở rộng Request để có req.user
declare global {
  namespace Express {
    interface Request {
      user?: any
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Thiếu token xác thực.' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, env.JWT_SECRET)

    // Gắn user đã decode vào request để các controller dùng được
    req.user = decoded

    next()
  } catch (error: any) {
    console.error('❌ Lỗi xác thực JWT:', error.message)
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' })
  }
}
