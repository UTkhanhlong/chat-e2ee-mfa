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

const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  rawPassword: z.string().min(6),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  dob: z.string().optional(),
})

const LoginSchema = z.object({
  identifier: z.string().min(3),
  rawPassword: z.string().min(6),
})

const Verify2FASchema = z.object({
  identifier: z.string(),
  code: z.string().length(6),
})

const ToggleMFASchema = z.object({ enable: z.boolean() })

// ĐÃ SỬA: user_id không còn bắt buộc – lấy từ token!
const UpdateKeySchema = z.object({
  ecdsa_key: z.string().min(1),
  ecdh_key: z.string().min(1),
  user_id: z.number().int().optional(), // ← cho phép thiếu
})

const ResetRequestSchema = z.object({ email: z.string().email() })
const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  newPassword: z.string().min(6),
})

/* ================================
   CONTROLLERS
   ================================ */

// REGISTER
export const register = asyncWrap(async (req: Request, res: Response) => {
  const payload = RegisterSchema.parse(req.body)
  const user = await AuthService.registerUser(payload)

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' }
  )

  res.status(201).json({
    message: 'Đăng ký thành công!',
    access: token,
    user: { id: user.id, username: user.username, email: user.email },
  })
})

// LOGIN
export const login = asyncWrap(async (req: Request, res: Response) => {
  const { identifier, rawPassword } = LoginSchema.parse(req.body)
  const user = await AuthService.authenticateUser(identifier, rawPassword)
  if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' })

  if (user.mfaEnabled) {
    const { code } = await AuthService.createAndSaveEmail2FACode(user.id)
    await sendMail({
      to: user.email,
      subject: 'Mã Xác Minh 2FA',
      html: htmlEmailTemplate('Mã 2FA', `<h2>${code}</h2>`),
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

// VERIFY 2FA EMAIL
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

// TOGGLE MFA
export const toggleMFAStatus = asyncWrap(async (req: AuthRequest, res: Response) => {
  const userId = req.user.userId
  const { enable } = ToggleMFASchema.parse(req.body)
  const newStatus = await AuthService.toggleMFA(userId, enable)
  res.json({ mfaEnabled: newStatus })
})

// UPDATE PUBLIC KEYS – ĐÃ FIX 100% LỖI 500
export const updatePublicKey = asyncWrap(async (req: AuthRequest, res: Response) => {
  const userId = req.user.userId // ← LẤY TỪ TOKEN, KHÔNG TỪ BODY

  // Chỉ lấy 2 key, user_id không bắt buộc
  const { ecdsa_key, ecdh_key } = UpdateKeySchema.parse(req.body)

  const user = await User.findByPk(userId)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })

  await user.update({ ecdsa_key, ecdh_key })
  console.log(`Cập nhật key thành công cho user #${userId} (ECDH + ECDSA)`)

  res.json({ message: 'Khóa công khai đã được cập nhật thành công!' })
})

// GET PUBLIC KEYS
export const getPublicKey = asyncWrap(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID không hợp lệ.' })

  const user = await User.findByPk(id, { attributes: ['id', 'username', 'ecdsa_key', 'ecdh_key'] })
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })
  if (!user.ecdh_key) return res.status(400).json({ error: 'Người dùng chưa upload ECDH key — không thể mã hóa PFS.' })

  res.json({
    id: user.id,
    username: user.username,
    ecdsa_key: user.ecdsa_key,
    ecdh_key: user.ecdh_key,
  })
})

// REQUEST PASSWORD RESET
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

// RESET PASSWORD
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