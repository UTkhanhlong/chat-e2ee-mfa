// src/modules/auth/auth.routes.ts
import { Router } from 'express'
import * as AuthController from './auth.controller'
import { verifyToken } from '../../middlewares/verifyToken'

const router = Router()

// Công khai
router.post('/register', AuthController.register)
router.post('/login', AuthController.login)
router.post('/request-reset', AuthController.requestReset)
router.post('/reset-password', AuthController.resetPassword)
router.post('/2fa/verify-email', AuthController.verify2FAByEmail)

// Bảo mật bằng JWT
router.post('/toggle-mfa', verifyToken, AuthController.toggleMFAStatus)
router.post('/update-key', verifyToken, AuthController.updatePublicKey)

// Công khai (khóa công khai)
router.get('/public-key/:id', AuthController.getPublicKey)

export default router