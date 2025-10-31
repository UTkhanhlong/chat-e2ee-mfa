import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../connectDB'

/**
 * RoomAttributes: Mỗi phòng chat (có thể là 1–1 hoặc nhóm)
 */
export interface RoomAttributes {
  id: number
  name: string
  type: 'private' | 'group'
  createdAt?: Date
  updatedAt?: Date
}

export interface RoomCreationAttributes
  extends Optional<RoomAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

/**
 * Room model
 */
export class Room
  extends Model<RoomAttributes, RoomCreationAttributes>
  implements RoomAttributes
{
  public id!: number
  public name!: string
  public type!: 'private' | 'group'
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

/**
 * Khởi tạo model Sequelize
 */
Room.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('private', 'group'),
      allowNull: false,
      defaultValue: 'private',
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
    tableName: 'rooms',
    modelName: 'Room',
    timestamps: true,
    underscored: true, // => created_at / updated_at
  }
)

export default Room
