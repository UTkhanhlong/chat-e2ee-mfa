import { Response } from 'express'
import * as ChatService from './chat.service'
import { io } from '../../server'
import { AuthRequest } from '../../middlewares/verifyToken'

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const user = req.user
    if (!user?.userId) throw new Error('Unauthorized')

    const { roomId, ciphertext, iv, signature, ephemeralPubKey } = req.body
    if (!roomId || !ciphertext || !iv || !signature || !ephemeralPubKey) {
      return res.status(400).json({ error: 'Thiếu field L2 PFS' })
    }

    const msg = await ChatService.sendMessage({
      roomId: Number(roomId),
      senderId: user.userId,
      ciphertext,
      iv,
      signature,
      ephemeral_pub_key: ephemeralPubKey,
    })

    if (!msg) return res.status(500).json({ error: 'Lỗi lưu tin nhắn' })

    const payload = {
      ...msg.toJSON(),
      sender: { id: user.userId, username: user.username, email: user.email },
    }

    io.to(`chat_room_${roomId}`).emit('new_message', payload)
    return res.json({ success: true, message: payload })
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const user = req.user
    if (!user?.userId) return res.status(401).json({ error: 'Unauthorized' })

    const roomId = Number(req.params.roomId)
    if (isNaN(roomId) || roomId <= 0) return res.status(400).json({ error: 'roomId không hợp lệ' })

    const messages = await ChatService.getMessageHistory(roomId)
    const formatted = messages.map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      ciphertext: m.ciphertext,
      iv: m.iv,
      signature: m.signature,
      ephemeralPubKey: m.ephemeral_pub_key,
      createdAt: m.createdAt,
    }))

    return res.json({ success: true, messages: formatted })
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi server' })
  }
}