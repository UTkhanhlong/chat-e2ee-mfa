// src/types/chat.ts

export interface DBMessageWithSender {
  id: number
  sender_id: number
  ciphertext: string
  iv: string
  signature: string
  ephemeral_pub_key: string
  createdAt: string | Date

  // Đây là phần quan trọng – nói cho TypeScript biết có sender
  sender: {
    id: number
    username: string
    email: string
  } | null
}