import { sequelize } from '../../data/connectDB'
import { User } from '../../data/models/user.model'
import { RegisterPayload } from './auth.interface'
import bcrypt from 'bcrypt'
import { Op, Transaction } from 'sequelize'
import { randomBytes } from 'crypto' // Cần thiết để tạo mã ngẫu nhiên

const SALT_ROUNDS = 10
const MFA_CODE_EXPIRY_MINUTES = 10 // Mã 2FA hết hạn sau 10 phút

/**
 * 🔁 Chuyển giới tính tiếng Việt → tiếng Anh (để lưu vào DB)
 */
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

/**
 * 💡 Hàm tiện ích: Tìm người dùng bằng email hoặc username
 */
export async function findUserByIdentifier(identifier: string) {
  return User.findOne({
    where: {
      [Op.or]: [{ email: identifier }, { username: identifier }],
    },
  })
}

/**
 * 🧩 Đăng ký người dùng mới
 */
export async function registerUser(payload: RegisterPayload) {
  let transaction: Transaction | null = null

  try {
    transaction = await sequelize.transaction()

    // 🔍 Kiểm tra username hoặc email đã tồn tại chưa
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: payload.email },
          { username: payload.username },
        ],
      },
      transaction,
    })

    if (existingUser) {
      await transaction.rollback()
      throw new Error('Email hoặc tên người dùng đã được sử dụng.')
    }

    // 🔒 Băm mật khẩu
    const passwordHash = await bcrypt.hash(payload.rawPassword, SALT_ROUNDS)

    // ✅ Tạo người dùng mới
    const newUser = await User.create(
      {
        username: payload.username || payload.email.split('@')[0],
        email: payload.email,
        passwordHash,
        publicKey: payload.publicKey ?? '',
        mfaEnabled: true, // 💡 Đặt 2FA qua Email là BẬT theo mặc định
        // ❌ Loại bỏ mfaTotpSecret và webauthnCredentials
        dob: payload.dob ?? null,
        gender: normalizeGender(payload.gender),
        // Các trường 2FA Email sẽ là null
      },
      { transaction }
    )

    await transaction.commit()

    const userOutput = newUser.toJSON()
    delete (userOutput as any).passwordHash

    console.log('✅ User registered successfully:', userOutput.email)
    return userOutput
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {})
    console.error('❌ Registration failed:', error)
    throw new Error(error instanceof Error ? error.message : 'Đăng ký thất bại.')
  }
}

/**
 * 🔐 Đăng nhập bằng email hoặc username
 * (Không thay đổi, chỉ trả về User để controller xử lý 2FA)
 */
export async function authenticateUser(identifier: string, rawPassword: string) {
  try {
    const user = await findUserByIdentifier(identifier)

    if (!user) {
      console.warn('⚠️ Không tìm thấy user:', identifier)
      return null
    }

    const isValid = await bcrypt.compare(
      rawPassword,
      user.getDataValue('passwordHash')
    )

    if (!isValid) {
      console.warn('⚠️ Sai mật khẩu cho user:', identifier)
      return null
    }

    const userOutput = user.toJSON()
    delete (userOutput as any).passwordHash

    // 🧠 Kiểm tra xem user có publicKey thật chưa (Giữ nguyên logic E2EE)
    if (!userOutput.publicKey || userOutput.publicKey.length < 100) {
      (userOutput as any).needsPublicKeyUpdate = true
      console.log(`⚙️ User ${userOutput.username} chưa có publicKey thật — cần frontend cập nhật.`)
    } else {
      console.log(`🔑 User ${userOutput.username} đã có publicKey hợp lệ.`)
    }

    console.log('✅ User authenticated (Password OK):', userOutput.username)
    return userOutput
  } catch (err) {
    console.error('❌ Lỗi trong authenticateUser:', err)
    throw new Error('Không thể xác thực người dùng.')
  }
}

/**
 * 📧 Tạo mã 2FA 6 chữ số, lưu vào DB và đặt thời gian hết hạn
 */
export async function createAndSaveEmail2FACode(userId: number) {
    const user = await User.findByPk(userId)
    if (!user) {
        throw new Error('Người dùng không tồn tại.')
    }

    // 🔢 Sinh mã 6 ký tự ngẫu nhiên (chỉ dùng chữ số)
    // Dùng randomBytes và chuyển sang base 10 (chỉ số)
    const code = randomBytes(3).toString('hex').slice(0, 6).toUpperCase() 
    
    // Tính toán thời gian hết hạn
    const expires = new Date(Date.now() + MFA_CODE_EXPIRY_MINUTES * 60 * 1000)

    // Cập nhật vào DB
    await user.update({
        email2FACode: code,
        email2FACodeExpires: expires,
    })

    return { code }
}

/**
 * 🔒 Xác minh mã 2FA gửi qua Email
 * Trả về User nếu mã hợp lệ và chưa hết hạn
 */
export async function verifyEmail2FACode(identifier: string, code: string) {
    const user = await findUserByIdentifier(identifier)
    
    if (!user) return null

    // 1. Kiểm tra mã khớp
    if (user.email2FACode !== code) {
        return null // Mã không khớp
    }

    // 2. Kiểm tra mã hết hạn
    if (!user.email2FACodeExpires || user.email2FACodeExpires < new Date()) {
        return null // Mã đã hết hạn
    }

    // 3. Hợp lệ! Xóa mã trong controller sau khi cấp JWT.
    console.log(`✅ Mã 2FA hợp lệ cho user: ${user.username}`)
    return user
}

/**
 * ⚙️ HÀM MỚI: Bật hoặc tắt 2FA qua Email cho người dùng đã đăng nhập
 */
export async function toggleMFA(userId: number, enable: boolean) {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error('Người dùng không tồn tại.');
    }
    
    await user.update({ 
        mfaEnabled: enable,
        // Khi TẮT 2FA (enable=false), đảm bảo xóa mã code cũ nếu có
        ...(enable ? {} : { email2FACode: null, email2FACodeExpires: null })
    });

    // Trả về trạng thái mới của 2FA
    return user.mfaEnabled;
}
