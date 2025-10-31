import { sequelize, connectDB } from './connectDB'
import { User } from './models/user.model'
import { Room } from './models/room.model'
import { Message } from './models/message.model'

/**
 * Thiết lập các quan hệ (Associations)
 */
function setupAssociations() {
  // User ↔ Message (1:N)
  User.hasMany(Message, {
    foreignKey: 'sender_id',
    as: 'sentMessages',
    onDelete: 'CASCADE',
  })
  Message.belongsTo(User, {
    foreignKey: 'sender_id',
    as: 'sender',
  })

  // Room ↔ Message (1:N)
  Room.hasMany(Message, {
    foreignKey: 'room_id',
    as: 'messages',
    onDelete: 'CASCADE',
  })
  Message.belongsTo(Room, {
    foreignKey: 'room_id',
    as: 'room',
  })

  console.log('🔗 Associations set up successfully.')
}

/**
 * Kết nối và đồng bộ database
 */
export async function connectDatabase() {
  await connectDB()
  setupAssociations()
  await sequelize.sync({ alter: true }) // ✅ Tự tạo bảng nếu chưa có
  console.log('💾 Database synced successfully!')
}

export { sequelize, User, Room, Message }
