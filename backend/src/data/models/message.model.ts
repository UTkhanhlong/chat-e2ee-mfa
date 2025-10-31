import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../connectDB'

/**
 * MessageAttributes: Bản ghi tin nhắn mã hoá E2EE
 */
export interface MessageAttributes {
  id: number
  room_id: number
  sender_id: number
  ciphertext: string
  iv: string
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
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

/**
 * Khởi tạo model Sequelize
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
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ciphertext: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    iv: {
      type: DataTypes.STRING(64),
      allowNull: false,
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
