import { Request, Response } from 'express'
import * as AuthService from './auth.service'
import { asyncWrap } from '../../common/errors'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { sendMail, htmlEmailTemplate } from '../../common/mailer'
import { randomBytes } from 'crypto'
import { User } from '../../data/models/user.model'

// 🧩 Schema cho Đăng ký (Giữ nguyên)
const RegisterSchema = z.object({
  username: z.string().min(3, 'Tên người dùng phải >= 3 ký tự'),
  email: z.string().email(),
  rawPassword: z.string().min(6, 'Mật khẩu phải >= 6 ký tự'),
  gender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  dob: z.string().optional(), // yyyy-mm-dd
  publicKey: z.string().optional(),
})

// 🧩 Schema cho Đăng nhập (Giữ nguyên)
const LoginSchema = z.object({
  identifier: z.string().min(3, 'Vui lòng nhập email hoặc tên người dùng'),
  rawPassword: z.string().min(6, 'Mật khẩu phải >= 6 ký tự'),
})

// 🧩 Schema cho Quên mật khẩu (Giữ nguyên)
const ResetRequestSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

// 🧩 Schema cho Đặt lại mật khẩu (Giữ nguyên)
const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4, 'Mã xác minh không hợp lệ'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải >= 6 ký tự'),
})

// 🧩 SCHEMA MỚI: Dành cho xác minh 2FA qua Email
const Verify2FASchema = z.object({
  identifier: z.string(), // Email hoặc username của người dùng
  code: z.string().min(4, 'Mã 2FA phải >= 4 ký tự'), // Mã xác minh nhận qua Email
})

// 🧩 SCHEMA MỚI: Schema cho việc bật tắt 2FA
const ToggleMFASchema = z.object({
    enable: z.boolean(),
})


/**
 * 🧩 POST /api/auth/register (Giữ nguyên)
 * Đăng ký người dùng mới
 */
export const register = asyncWrap(async (req: Request, res: Response) => {
  try {
    const payload = RegisterSchema.parse(req.body)
    const user = await AuthService.registerUser(payload)

    res.status(201).json({
      message: '🎉 Đăng ký thành công!',
      user,
    })
  } catch (err: any) {
    console.error('❌ [auth.controller] Lỗi đăng ký:', err)
    res.status(400).json({
      error: err.message || 'Đăng ký thất bại',
    })
  }
})

// ---

/**
 * 🧩 POST /api/auth/login
 * BƯỚC 1: Xác thực mật khẩu và YÊU CẦU MÃ 2FA QUA EMAIL
 */
export const login = asyncWrap(async (req: Request, res: Response) => {
  try {
    const { identifier, rawPassword } = LoginSchema.parse(req.body)
    const user = await AuthService.authenticateUser(identifier, rawPassword)

    if (!user) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' })
    }
    
    // 💡 Logic 2FA qua Email BẮT ĐẦU: Chỉ gửi mã nếu MFA được bật
    if (user.mfaEnabled) {
      
      // 1. Tạo và lưu mã 2FA mới (dùng hàm service mới)
      const { code } = await AuthService.createAndSaveEmail2FACode(user.id)
      
      // 2. Gửi email
      const html = htmlEmailTemplate(
        'Mã xác minh Đăng nhập',
        `<p>Xin chào ${user.username},</p>
         <p>Mã xác minh 2FA của bạn là:</p>
         <h2 style="color:#007bff">${code}</h2>
         <p>Vui lòng nhập mã này để hoàn tất đăng nhập. Mã có hiệu lực trong 10 phút.</p>`
      )

      await sendMail({
        to: user.email, // Gửi đến email của người dùng
        subject: '🔑 Mã Xác Minh 2FA Đăng Nhập',
        html,
      })

      console.log(`📧 2FA code sent to ${user.email}: ${code}`)
      
      // 3. Trả về cờ yêu cầu Frontend chuyển sang màn hình nhập mã
      return res.status(200).json({
        message: 'Xác thực thành công. Mã 2FA đã được gửi đến email của bạn.',
        required2fa: true, // Cờ này quan trọng để Frontend biết
        identifier: identifier, // Trả lại để Frontend sử dụng trong bước xác minh
      })
    }

    // ✅ Sinh JWT (Nếu MFA TẮT hoặc không có cờ required2fa)
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '2h' }
    )

    return res.json({
      message: 'Đăng nhập thành công 🎉',
      access: token,
      user,
    })
  } catch (err: any) {
    console.error('❌ [auth.controller] Lỗi đăng nhập:', err)
    res.status(400).json({
      error: err.message || 'Đăng nhập thất bại',
    })
  }
})

/**
 * 🧩 POST /api/auth/2fa/verify-email
 * BƯỚC 2: XÁC MINH MÃ 2FA GỬI QUA EMAIL và cấp JWT
 */
export const verify2FAByEmail = asyncWrap(async (req: Request, res: Response) => {
  try {
    const { identifier, code } = Verify2FASchema.parse(req.body)

    // 1. Xác minh mã (dùng hàm service mới)
    const user = await AuthService.verifyEmail2FACode(identifier, code) 

    if (!user) {
      return res.status(401).json({ error: 'Mã xác minh không hợp lệ hoặc đã hết hạn.' })
    }

    // 2. Cấp JWT khi xác minh thành công
    const jwtToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '2h' }
    )

    // 3. Xóa mã 2FA sau khi sử dụng để đảm bảo mã chỉ dùng được 1 lần
    await user.update({ email2FACode: null, email2FACodeExpires: null });

    return res.json({
      message: 'Xác minh 2FA và đăng nhập thành công 🎉',
      access: jwtToken,
      user,
    })
  } catch (err: any) {
    console.error('❌ [auth.controller] Lỗi xác minh 2FA:', err)
    res.status(400).json({
      error: err.message || 'Xác minh 2FA thất bại',
    })
  }
})

/**
 * ⚙️ POST /api/auth/toggle-mfa
 * Controller mới: Bật hoặc tắt 2FA cho người dùng đã đăng nhập
 */
export const toggleMFAStatus = asyncWrap(async (req: Request, res: Response) => {
    // 💡 Giả định middleware auth đã đặt userId vào req.user.userId.
    // Nếu bạn không có middleware JWT, bạn phải gửi userId qua body.
    // Tạm thời, tôi sẽ giả định rằng userId được gửi qua body.
    const userId = (req as any).user?.userId || req.body.userId; 
    
    if (!userId) {
        return res.status(401).json({ error: 'Không được ủy quyền. Thiếu ID người dùng.' });
    }

    try {
        const { enable } = ToggleMFASchema.parse(req.body);
        
        const newStatus = await AuthService.toggleMFA(userId, enable);
        
        res.json({ 
            message: `Đã ${newStatus ? 'BẬT' : 'TẮT'} xác thực 2FA thành công.`,
            mfaEnabled: newStatus 
        });
    } catch (err: any) {
        console.error('❌ [auth.controller] Lỗi bật/tắt 2FA:', err);
        res.status(400).json({ error: err.message || 'Cập nhật 2FA thất bại.' });
    }
});

// ---

/**
 * 🧩 POST /api/auth/request-reset (Giữ nguyên)
 * Gửi mã xác minh đặt lại mật khẩu qua Gmail
 */
export const requestReset = asyncWrap(async (req: Request, res: Response) => {
  try {
    const { email } = ResetRequestSchema.parse(req.body)

    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng với email này.' })
    }

    // 🔢 Sinh mã 6 ký tự
    const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6)
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 phút

    await user.update({ resetCode: code, resetCodeExpires: expires })

    const html = htmlEmailTemplate(
      'Đặt lại mật khẩu Secure Chat',
      `<p>Xin chào ${user.username},</p>
       <p>Mã xác minh đặt lại mật khẩu của bạn là:</p>
       <h2 style="color:#007bff">${code}</h2>
       <p>Mã có hiệu lực trong 10 phút.</p>`
    )

    await sendMail({
      to: email,
      subject: '🔐 Mã xác minh đặt lại mật khẩu',
      html,
    })

    console.log(`📧 Reset code sent to ${email}: ${code}`)
    res.json({ message: '📧 Mã xác minh đã được gửi đến email của bạn.' })
  } catch (err: any) {
    console.error('❌ [auth.controller] Lỗi gửi mã khôi phục:', err)
    res.status(400).json({ error: err.message || 'Không thể gửi mã xác minh.' })
  }
})

/**
 * 🧩 POST /api/auth/reset-password (Giữ nguyên)
 * Xác minh mã và đổi mật khẩu
 */
export const resetPassword = asyncWrap(async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = ResetPasswordSchema.parse(req.body)

    const user = await User.findOne({ where: { email, resetCode: code } })
    if (!user) return res.status(400).json({ error: 'Mã hoặc email không hợp lệ.' })

    if (user.resetCodeExpires && user.resetCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Mã xác minh đã hết hạn.' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await user.update({
      passwordHash,
      resetCode: null,
      resetCodeExpires: null,
    })

    res.json({ message: '✅ Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' })
  } catch (err: any) {
    console.error('❌ [auth.controller] Lỗi đặt lại mật khẩu:', err)
    res.status(400).json({ error: err.message || 'Không thể đặt lại mật khẩu.' })
  }
})

/**
 * 🧩 POST /api/auth/update-key (Giữ nguyên)
 * Cập nhật publicKey thật cho người dùng (client gửi sau khi sinh cặp khóa)
 */
export const updatePublicKey = asyncWrap(async (req: Request, res: Response) => {
  const { user_id, public_key } = req.body

  if (!user_id || !public_key) {
    return res.status(400).json({ error: 'Thiếu user_id hoặc public_key.' })
  }

  const user = await User.findByPk(user_id)
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })

  await user.update({ publicKey: public_key })
  console.log(`🔑 Public key updated for user #${user_id}`)
  res.json({ message: 'Public key updated successfully.' })
})

/**
 * 🧩 GET /api/auth/public-key/:id (Giữ nguyên)
 * Trả về publicKey của người khác (dùng để derive AES)
 */
export const getPublicKey = asyncWrap(async (req: Request, res: Response) => {
  const id = req.params.id
  const user = await User.findByPk(id, { attributes: ['id', 'username', 'publicKey'] })
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' })

  res.json({ public_key: user.publicKey, username: user.username })
})
