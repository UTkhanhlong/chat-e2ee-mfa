import { Router } from 'express'
import * as ChatController from './chat.controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

// DÙNG `as any` ĐỂ TRÁNH LỖI TS TRONG ROUTE
router.get('/history/:roomId', verifyToken, ChatController.getHistory as any)
router.post('/send', verifyToken, ChatController.sendMessage as any)

export default router