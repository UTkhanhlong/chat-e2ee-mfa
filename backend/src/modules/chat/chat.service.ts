import { Message, User } from '../../data/index'
import { Op } from 'sequelize'

interface SendMessageDTO {
  roomId: number
  senderId: number
  ciphertext: string
  iv: string
}

/**
 * 📨 Gửi tin nhắn (lưu vào bảng messages)
 */
export async function sendMessage(data: SendMessageDTO) {
  try {
    // 🧩 Tạo tin nhắn mới
    const message = await Message.create({
      room_id: data.roomId,
      sender_id: data.senderId,
      ciphertext: data.ciphertext,
      iv: data.iv,
    })

    console.log(`✅ Tin nhắn đã lưu (room=${data.roomId}, sender=${data.senderId})`)

    // 🧩 Lấy lại bản ghi vừa tạo, kèm username/email người gửi
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'email'], // 👈 chỉ lấy field có thật
        },
      ],
    })

    return fullMessage
  } catch (error) {
    console.error('❌ Lỗi khi lưu tin nhắn:', error)
    throw new Error('Không thể lưu tin nhắn vào cơ sở dữ liệu.')
  }
}

/**
 * 💬 Lấy toàn bộ lịch sử tin nhắn của một phòng
 */
export async function getMessageHistory(roomId: number) {
  try {
    const messages = await Message.findAll({
      where: { room_id: roomId },
      order: [['created_at', 'ASC']],
      include: [
        {
          model: User,
          as: 'sender', // 👈 trùng alias trong data/index.ts
          attributes: ['id', 'username', 'email'],
        },
      ],
    })

    console.log(`📜 Đã lấy ${messages.length} tin nhắn từ room=${roomId}`)
    return messages
  } catch (error) {
    console.error('❌ Lỗi khi lấy lịch sử tin nhắn:', error)
    throw new Error('Không thể lấy lịch sử tin nhắn.')
  }
}
