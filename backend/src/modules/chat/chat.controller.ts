import { Request, Response } from 'express'
import * as ChatService from './chat.service'
import { io } from '../../server'

// 📨 [POST] /api/chat/send
export async function sendMessage(req: Request, res: Response) {
  try {
    // ✅ Lấy user từ middleware (verifyToken)
    const user = (req as any).user
    if (!user || !user.userId) {
      return res.status(401).json({ error: 'Không xác định được người gửi. Bạn cần đăng nhập lại.' })
    }

    const { roomId, ciphertext, iv } = req.body || {}

    if (!roomId || !ciphertext || !iv) {
      console.warn('⚠️ Body không hợp lệ:', req.body)
      return res.status(400).json({ error: 'Thiếu dữ liệu cần thiết (roomId, ciphertext, iv).' })
    }

    // ✅ Lưu tin nhắn
    const msg = await ChatService.sendMessage({
      roomId,
      senderId: user.userId, // 👈 lấy đúng field từ token
      ciphertext,
      iv,
    })

    // 💡 KHẮC PHỤC LỖI: Kiểm tra nếu msg là null/undefined
    if (!msg) {
        console.error('❌ Tin nhắn không được tạo trong service, trả về 500.')
        return res.status(500).json({ error: 'Lỗi máy chủ khi lưu tin nhắn.' })
    }

    // 💡 LOGIC REAL-TIME MỚI: Phát tin nhắn qua Socket.IO
    // KHẮC PHỤC LỖI: Sử dụng .toJSON() để loại bỏ tham chiếu vòng tròn của Sequelize.
    io.to(`chat_room_${roomId}`).emit('new_message', {
      ...msg.toJSON(), // Chuyển đổi Model sang POJO
      sender: { id: user.userId, username: user.username, email: user.email } // Gửi kèm thông tin người gửi
    })

    return res.json({ success: true, message: msg })
  } catch (error: any) {
    console.error('❌ Lỗi gửi tin nhắn:', error)
    return res.status(500).json({ error: 'Lỗi máy chủ khi lưu tin nhắn.' })
  }
}

// 💬 [GET] /api/chat/history/:roomId (Giữ nguyên)
export async function getHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user
    if (!user || !user.userId) {
      return res.status(401).json({ error: 'Không xác định được người dùng. Bạn cần đăng nhập lại.' })
    }

    const roomId = Number(req.params.roomId)
    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ error: 'roomId không hợp lệ.' })
    }

    const messages = await ChatService.getMessageHistory(roomId)
    return res.json({ success: true, messages })
  } catch (error: any) {
    console.error('❌ Lỗi lấy lịch sử chat:', error)
    return res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn.' })
  }
}
