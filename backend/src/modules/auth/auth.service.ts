import { sequelize } from '../../data/connectDB'
import { User } from '../../data/models/user.model'
import { RegisterPayload } from './auth.interface'
import bcrypt from 'bcrypt'
import { Op, Transaction } from 'sequelize'
import { randomBytes } from 'crypto'

const SALT_ROUNDS = 10
const MFA_CODE_EXPIRY_MINUTES = 10

function normalizeGender(gender?: string): 'male' | 'female' | 'other' | null {
  switch (gender?.trim().toLowerCase()) {
    case 'nam': return 'male'
    case 'nữ':
    case 'nu': return 'female'
    case 'khác':
    case 'khac': return 'other'
    default: return null
  }
}

export async function findUserByIdentifier(identifier: string) {
  return User.findOne({
    where: {
      [Op.or]: [{ email: identifier }, { username: identifier }],
    },
    attributes: { include: ['mfaEnabled', 'passwordHash'] }, // camelCase vì model dùng mfaEnabled
  })
}

export async function registerUser(payload: RegisterPayload) {
  let transaction: Transaction | null = null

  try {
    transaction = await sequelize.transaction()

    const existingUser = await User.findOne({
      where: { [Op.or]: [{ email: payload.email }, { username: payload.username }] },
      transaction,
    })

    if (existingUser) {
      await transaction.rollback()
      throw new Error('Email hoặc tên người dùng đã được sử dụng.')
    }

    const passwordHash = await bcrypt.hash(payload.rawPassword, SALT_ROUNDS)

    const newUser = await User.create(
      {
        username: payload.username || payload.email.split('@')[0],
        email: payload.email,
        passwordHash,
        ecdh_key: (payload as any).ecdh_key ?? null,
        ecdsa_key: (payload as any).ecdsa_key ?? null,
        mfaEnabled: false,        // TẮT MẶC ĐỊNH – chỉ bật khi user tự toggle
        dob: payload.dob ?? null,
        gender: normalizeGender(payload.gender),
      },
      { transaction }
    )

    await transaction.commit()
    const userOutput = newUser.toJSON()
    delete (userOutput as any).passwordHash
    console.log('User registered successfully:', userOutput.email)
    return userOutput
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {})
    console.error('Registration failed:', error)
    throw new Error(error instanceof Error ? error.message : 'Đăng ký thất bại.')
  }
}

export async function authenticateUser(identifier: string, rawPassword: string) {
  try {
    const user = await findUserByIdentifier(identifier)
    if (!user) return null

    const isValid = await bcrypt.compare(rawPassword, user.getDataValue('passwordHash'))
    if (!isValid) return null

    console.log(`DEBUG 2FA: mfaEnabled = ${user.mfaEnabled}`)  // camelCase → đúng
    console.log(`DEBUG 2FA: typeof = ${typeof user.mfaEnabled}`)

    const userOutput = user.toJSON()
    delete (userOutput as any).passwordHash

    if (!userOutput.ecdh_key || !userOutput.ecdsa_key) {
      ;(userOutput as any).needsPublicKeyUpdate = true
    }

    console.log('User authenticated:', userOutput.username)
    return userOutput
  } catch (err) {
    console.error('Lỗi authenticateUser:', err)
    throw new Error('Không thể xác thực người dùng.')
  }
}

export async function createAndSaveEmail2FACode(userId: number) {
  const user = await User.findByPk(userId)
  if (!user) throw new Error('Người dùng không tồn tại.')

  const rnd = parseInt(randomBytes(4).toString('hex'), 16) % 1000000
  const code = rnd.toString().padStart(6, '0')
  const expires = new Date(Date.now() + MFA_CODE_EXPIRY_MINUTES * 60 * 1000)

  await user.update({
    email2FACode: code,
    email2FACodeExpires: expires,
  })

  return { code }
}

export async function verifyEmail2FACode(identifier: string, code: string) {
  const user = await findUserByIdentifier(identifier)
  if (!user) return null

  if (!user.mfaEnabled) {  // camelCase → đúng
    console.warn('User cố verify 2FA nhưng chưa bật:', identifier)
    return null
  }

  if (user.email2FACode !== code) return null
  if (!user.email2FACodeExpires || user.email2FACodeExpires < new Date()) return null

  console.log(`Mã 2FA hợp lệ cho user: ${user.username}`)
  return user
}

export async function toggleMFA(userId: number, enable: boolean) {
  const user = await User.findByPk(userId)
  if (!user) throw new Error('Người dùng không tồn tại.')

  console.log(`TOGGLE 2FA → User ${userId}: ${enable ? 'BẬT' : 'TẮT'}`)

  await user.update({
    mfaEnabled: enable,           // camelCase → TypeScript vui
    email2FACode: null,
    email2FACodeExpires: null,
  })

  console.log(`2FA đã ${enable ? 'bật' : 'tắt'} thành công cho ${user.username}`)
  return user.mfaEnabled        // trả về true/false
}