import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../connectDB'

/**
 * MessageAttributes: Bản ghi tin nhắn E2EE L2 (PFS + Chữ ký)
 */
export interface MessageAttributes {
  id: number
  room_id: number
  sender_id: number

  // L2 PFS: 4 FIELD BẮT BUỘC
  ciphertext: string
  iv: string
  signature: string         // ECDSA signature (base64)
  ephemeral_pub_key: string // Ephemeral ECDH public key (base64)

  createdAt?: Date
  updatedAt?: Date
}

export interface MessageCreationAttributes
  extends Optional<MessageAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  public id!: number
  public room_id!: number
  public sender_id!: number
  public ciphertext!: string
  public iv!: string
  public signature!: string
  public ephemeral_pub_key!: string

  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

/**
 * Khởi tạo model Sequelize (L2 PFS)
 */
Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    room_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'room_id',
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sender_id',
    },
    ciphertext: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Tin nhắn đã mã hóa AES-GCM',
    },
    iv: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'Initialization Vector (base64)',
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'signature',
      comment: 'ECDSA signature của ciphertext (base64) - Chống MITM',
    },
    ephemeral_pub_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'ephemeral_pub_key',
      comment: 'ECDH public key tạm (base64) - PFS',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'messages',
    modelName: 'Message',
    timestamps: true,
    underscored: true,
  }
)

export default Message