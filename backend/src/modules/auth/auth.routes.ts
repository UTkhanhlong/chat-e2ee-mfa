import { Router } from 'express'
import * as AuthController from './auth.controller'

const router = Router()

router.post('/register', AuthController.register)
router.post('/login', AuthController.login)
router.post('/request-reset', AuthController.requestReset)
router.post('/reset-password', AuthController.resetPassword)

// 🧩 ROUTE XÁC MINH 2FA qua Email
router.post('/2fa/verify-email', AuthController.verify2FAByEmail)

// ⚙️ ROUTE MỚI: Bật/Tắt 2FA thủ công
router.post('/toggle-mfa', AuthController.toggleMFAStatus)

// 🧩 E2EE routes
router.post('/update-key', AuthController.updatePublicKey)
router.get('/public-key/:id', AuthController.getPublicKey)

export default router
