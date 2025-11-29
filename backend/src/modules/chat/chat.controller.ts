import { Response } from 'express'
import * as ChatService from './chat.service'
import { io } from '../../server'
import { AuthRequest } from '../../middlewares/verifyToken'
import type { DBMessageWithSender } from '../../types/chat' // ← ĐÃ THÊM ĐÚNG CHỖ

/**
 * Gửi tin nhắn
 */
export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const user = req.user
    if (!user?.userId) throw new Error('Unauthorized')

    const { roomId, ciphertext, iv, signature, ephemeralPubKey } = req.body

    // Validate 4 field PFS
    if (!roomId || !ciphertext || !iv || !signature || !ephemeralPubKey) {
      return res.status(400).json({ error: 'Thiếu field L2 PFS' })
    }

    // Lưu message vào DB
    const msg = await ChatService.sendMessage({
      roomId: Number(roomId),
      senderId: user.userId,
      ciphertext,
      iv,
      signature,
      ephemeral_pub_key: ephemeralPubKey,
    })

    if (!msg) return res.status(500).json({ error: 'Lỗi lưu tin nhắn' })

    // Payload gửi về frontend và socket – camelCase chuẩn
    const payload = {
      id: msg.id,
      sender_id: msg.sender_id,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      signature: msg.signature,
      ephemeralPubKey: msg.ephemeral_pub_key,
      createdAt: msg.createdAt,
      sender: {
        id: user.userId,
        username: user.username,
        email: user.email,
      },
    }

    // Emit real-time
    io.to(`chat_room_${roomId}`).emit('new_message', payload)

    return res.json({ success: true, message: payload })
  } catch (error: any) {
    console.error('SendMessage Error:', error)
    return res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
}

/**
 * Lấy lịch sử tin nhắn
 */
export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const user = req.user
    if (!user?.userId) return res.status(401).json({ error: 'Unauthorized' })

    const roomId = Number(req.params.roomId)
    if (isNaN(roomId) || roomId <= 0) {
      return res.status(400).json({ error: 'roomId không hợp lệ' })
    }

    // ← ĐÃ ÉP KIỂU ĐÚNG NHƯ CON MUỐN – LỖI TS BIẾN MẤT HOÀN TOÀN!
    const messages = (await ChatService.getMessageHistory(roomId)) as DBMessageWithSender[]

    // Map đúng chuẩn camelCase cho frontend
    const formatted = messages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      ciphertext: m.ciphertext,
      iv: m.iv,
      signature: m.signature,
      ephemeralPubKey: m.ephemeral_pub_key,
      createdAt: m.createdAt,
      sender: m.sender
        ? {
            id: m.sender.id,
            username: m.sender.username,
            email: m.sender.email,
          }
        : null,
    }))

    return res.json({ success: true, messages: formatted })
  } catch (error: any) {
    console.error('GetHistory Error:', error)
    return res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
}