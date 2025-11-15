// modules/auth/auth.controller.ts
import { Request, Response } from 'express'
import * as AuthService from './auth.service'
import { asyncWrap } from '../../common/errors'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { sendMail, htmlEmailTemplate } from '../../common/mailer'
import { randomBytes } from 'crypto'
import { User } from '../../data/models/user.model'
import { AuthRequest } from '../../middlewares/verifyToken'

/* ================================
   ZOD SCHEMAS
   ================================ */
const RegisterSchema = z.object({
  username: z.string().min(3, 'Tên người dùng phải >= 3 ký tự'),
  email: z.string().email(),
  rawPassword: z.string().min(6, 'Mật khẩu phải >= 6 ký tự'),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  dob: z.string().optional(),
})

const LoginSchema = z.object({
  identifier: z.string().min(3),
  rawPassword: z.string().min(6),
})

const ResetRequestSchema = z.object({ email: z.string().email() })
const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  newPassword: z.string().min(6),
})
const Verify2FASchema = z.object({
  identifier: z.string(),
  code: z.string().length(6, 'Mã 2FA phải đúng 6 chữ số'),
})
const ToggleMFASchema = z.object({ enable: z.boolean() })
const UpdateKeySchema = z.object({
  user_id: z.number().int(),
  ecdsa_key: z.string().min(1, 'ECDSA key không hợp lệ'),
})

/* ================================
   CONTROLLERS
   ================================ */

/**
 * POST /api/auth/register
 * → Trả JWT luôn để frontend gọi update-key ngay lập tức
 */
export const register = asyncWrap(async (req: Request, res: Response) => {
  const payload = RegisterSchema.parse(req.body)
  const user = await AuthService.registerUser(payload)

  // TẠO JWT NGAY SAU KHI ĐĂNG KÝ
  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' }
  )

  res.status(201).json({
    message: 'Đăng ký thành công!',
    access: token,                                            // TRẢ VỀ TOKEN
    user: { id: user.id, username: user.username, email: user.email },
  })
})

/**
 * POST /api/auth/login
 */
export const login = asyncWrap(async (req: Request, res: Response) => {
  const { identifier, rawPassword } = LoginSchema.parse(req.body)
  const user = await AuthService.authenticateUser(identifier, rawPassword)

  if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' })

  if (user.mfaEnabled) {
    const { code } = await AuthService.createAndSaveEmail2FACode(user.id)
    await sendMail({
      to: user.email,
      subject: 'Mã Xác Minh 2FA',
      html: htmlEmailTemplate(
        'Mã xác minh đăng nhập',
        `<p>Mã 2FA của bạn là: <h2>${code}</h2><p>Hiệu lực 10 phút.</p>`
      ),
    })
    return res.json({ required2fa: true })
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' }
  )

  res.json({
    access: token,
    user: { id: user.id, username: user.username, email: user.email, mfaEnabled: user.mfaEnabled },
  })
})

/**
 * POST /api/auth/2fa/verify-email
 */
export const verify2FAByEmail = asyncWrap(async (req: Request, res: Response) => {
  const { identifier, code } = Verify2FASchema.parse(req.body)
  const user = await AuthService.verifyEmail2FACode(identifier, code)

  if (!user) return res.status(401).json({ error: 'Mã 2FA không hợp lệ hoặc hết hạn.' })

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' }
  )

  await user.update({ email2FACode: null, email2FACodeExpires: null })

  res.json({
    access: token,
    user: { id: user.id, username: user.username, email: user.email, mfaEnabled: user.mfaEnabled },
  })
})

/**
 * POST /api/auth/toggle-mfa
 */
export const toggleMFAStatus = asyncWrap(async (req: AuthRequest, res: Response) => {
  const userId = req.user.userId
  const { enable } = ToggleMFASchema.parse(req.body)
  const newStatus = await AuthService.toggleMFA(userId, enable)

  res.json({ mfaEnabled: newStatus })
})

/**
 * POST /api/auth/request-reset
 */
export const requestReset = asyncWrap(async (req: Request, res: Response) => {
  const { email } = ResetRequestSchema.parse(req.body)
  const user = await User.findOne({ where: { email } })
  if (!user) return res.status(404).json({ error: 'Không tìm thấy email.' })

  const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
  await user.update({ resetCode: code, resetCodeExpires: new Date(Date.now() + 10 * 60 * 1000) })

  await sendMail({
    to: email,
    subject: 'Đặt lại mật khẩu',
    html: htmlEmailTemplate('Mã đặt lại mật khẩu', `<h2>${code}</h2><p>Hiệu lực 10 phút.</p>`),
  })

  res.json({ message: 'Mã đã được gửi qua email.' })
})

/**
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncWrap(async (req: Request, res: Response) => {
  const { email, code, newPassword } = ResetPasswordSchema.parse(req.body)
  const user = await User.findOne({ where: { email, resetCode: code } })

  if (!user || !user.resetCodeExpires || user.resetCodeExpires < new Date())
    return res.status(400).json({ error: 'Mã không hợp lệ hoặc đã hết hạn.' })

  await user.update({
    passwordHash: await bcrypt.hash(newPassword, 10),
    resetCode: null,
    resetCodeExpires: null,
  })

  res.json({ message: 'Đặt lại mật khẩu thành công!' })
})

/**
 * POST /api/auth/update-key (YÊU CẦU JWT)
 */
export const updatePublicKey = asyncWrap(async (req: AuthRequest, res: Response) => {
  const userId = req.user.userId
  const { ecdsa_key } = UpdateKeySchema.parse(req.body)

  const user = await User.findByPk(userId)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })

  await user.update({ ecdsa_key })
  console.log(`ECDSA key cập nhật cho user #${userId}`)

  res.json({ message: 'Khóa chữ ký đã được cập nhật.' })
})

/**
 * GET /api/auth/public-key/:id (CÔNG KHAI)
 */
export const getPublicKey = asyncWrap(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })

  const user = await User.findByPk(id, { attributes: ['id', 'username', 'ecdsa_key'] })
  if (!user || !user.ecdsa_key) return res.status(404).json({ error: 'Chưa thiết lập khóa.' })

  res.json({ public_key: user.ecdsa_key, username: user.username })
})