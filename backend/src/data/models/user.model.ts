// data/models/user.model.ts
import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../connectDB'

/**
 * Thuộc tính của bảng Users (L2 PFS - Chỉ dùng ECDSA cho chữ ký)
 */
export interface UserAttributes {
  id: number
  username: string
  email: string
  passwordHash: string

  // L2: CHỈ DÙNG ECDSA KEY (cho Digital Signature)
  ecdsa_key: string | null     // ECDSA public key (base64)

  mfaEnabled: boolean

  // 2FA GỬI QUA EMAIL
  email2FACode: string | null
  email2FACodeExpires: Date | null

  // Thông tin mở rộng
  dob: string | null
  gender: 'male' | 'female' | 'other' | null

  // Xác minh email
  emailVerified: boolean
  emailVerificationCode: string | null
  emailVerificationExpires: Date | null

  // Reset mật khẩu
  resetCode: string | null
  resetCodeExpires: Date | null

  createdAt?: Date
  updatedAt?: Date
}

export interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | 'id'
    | 'mfaEnabled'
    | 'dob'
    | 'gender'
    | 'emailVerified'
    | 'emailVerificationCode'
    | 'emailVerificationExpires'
    | 'resetCode'
    | 'resetCodeExpires'
    | 'createdAt'
    | 'updatedAt'
    | 'ecdsa_key'
    | 'email2FACode'
    | 'email2FACodeExpires'
  > {}

/**
 * Model User (L2 PFS - Chỉ dùng ECDSA)
 */
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number
  public username!: string
  public email!: string
  public passwordHash!: string

  // CHỈ DÙNG ECDSA KEY
  public ecdsa_key!: string | null

  public mfaEnabled!: boolean
  public email2FACode!: string | null
  public email2FACodeExpires!: Date | null

  public dob!: string | null
  public gender!: 'male' | 'female' | 'other' | null
  public emailVerified!: boolean
  public emailVerificationCode!: string | null
  public emailVerificationExpires!: Date | null
  public resetCode!: string | null
  public resetCodeExpires!: Date | null

  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { len: [3, 100] },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: { type: DataTypes.TEXT, allowNull: false, field: 'password_hash' },

    // L2: CHỈ DÙNG ECDSA KEY (CHO CHỮ KÝ SỐ)
    ecdsa_key: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      field: 'ecdsa_key',
      comment: 'ECDSA public key (base64) - Dùng để xác minh chữ ký tin nhắn PFS',
    },

    mfaEnabled: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'mfa_enabled' },

    // 2FA GỬI QUA EMAIL
    email2FACode: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'email_2fa_code',
      comment: 'Mã xác minh 2FA qua email',
    },
    email2FACodeExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_2fa_code_expires',
    },

    // Thông tin cá nhân
    dob: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },

    // Xác minh email
    emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    emailVerificationCode: { type: DataTypes.STRING(12), allowNull: true },
    emailVerificationExpires: { type: DataTypes.DATE, allowNull: true },

    // Reset mật khẩu
    resetCode: { type: DataTypes.STRING(12), allowNull: true },
    resetCodeExpires: { type: DataTypes.DATE, allowNull: true },

    createdAt: { type: DataTypes.DATE, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
  },
  {
    sequelize,
    tableName: 'users',
    modelName: 'User',
    timestamps: true,
    underscored: true,
  }
)

export default User