// src/modules/chat/chat.service.ts
import { Message, User } from '../../data/index'
import { Op } from 'sequelize'

interface SendMessageDTO {
  roomId: number
  senderId: number
  ciphertext: string
  iv: string
  signature: string
  ephemeral_pub_key: string
}

/**
 * Gửi tin nhắn L2 PFS (4 field)
 */
export async function sendMessage(data: SendMessageDTO) {
  try {
    // Validate bắt buộc L2 PFS
    if (!data.signature || !data.ephemeral_pub_key) {
      throw new Error('Thiếu signature hoặc ephemeral_pub_key (L2 PFS)')
    }

    // Tạo tin nhắn mới
    const message = await Message.create({
      room_id: data.roomId,
      sender_id: data.senderId,
      ciphertext: data.ciphertext,
      iv: data.iv,
      signature: data.signature,
      ephemeral_pub_key: data.ephemeral_pub_key,
    })

    console.log(`Tin nhắn L2 PFS lưu thành công (room=${data.roomId}, sender=${data.senderId})`)

    // Lấy lại bản ghi + thông tin người gửi
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'email'],
        },
      ],
    })

    if (!fullMessage) {
      throw new Error('Lỗi: Không tìm thấy tin nhắn vừa tạo')
    }

    return fullMessage
  } catch (error: any) {
    console.error('Lỗi khi lưu tin nhắn L2 PFS:', error)
    throw new Error(error.message || 'Không thể lưu tin nhắn vào cơ sở dữ liệu.')
  }
}

/**
 * Lấy lịch sử tin nhắn – Trả về đầy đủ 4 field L2 PFS
 */
export async function getMessageHistory(roomId: number) {
  try {
    const messages = await Message.findAll({
      where: { room_id: roomId },
      order: [['created_at', 'ASC']],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'username', 'email'],
        },
      ],
    })

    console.log(`Đã lấy ${messages.length} tin nhắn L2 PFS từ room=${roomId}`)
    return messages
  } catch (error: any) {
    console.error('Lỗi khi lấy lịch sử tin nhắn:', error)
    throw new Error('Không thể lấy lịch sử tin nhắn.')
  }
}