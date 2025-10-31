import { Router } from 'express'
import * as ChatController from './chat.controller'
import { verifyToken } from '../../middlewares/auth.middleware'

const router = Router()

router.get('/history/:roomId', verifyToken, ChatController.getHistory)
router.post('/send', verifyToken, ChatController.sendMessage)

export default router
