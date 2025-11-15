import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user: {
    userId: number
    username: string
    email: string
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Thiếu hoặc sai định dạng token JWT' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey') as any
    ;(req as AuthRequest).user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
    }
    next()
  } catch (err: any) {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' })
  }
}