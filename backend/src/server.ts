import * as dotenv from 'dotenv'
dotenv.config()

import * as http from 'http' // 💡 Import module http
import { Server as SocketIOServer } from 'socket.io' // 💡 Import Socket.IO Server
import { env } from './config/env'
import app from './app'
import { connectDatabase } from './data'

const PORT = env.PORT || 4000

// 💡 1. Tạo HTTP server từ ứng dụng Express
const httpServer = http.createServer(app)

// 💡 2. Khởi tạo Socket.IO server và cấu hình CORS
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS, // Cho phép kết nối từ Frontend
    methods: ['GET', 'POST'],
  },
})

// 💡 3. Xử lý kết nối Socket.IO
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`)

  // 🔌 Gửi tin nhắn chào mừng (Tùy chọn)
  socket.emit('status', 'Connected to chat server')

  // 📝 Logic cơ bản: Người dùng tham gia vào phòng chat mặc định (Room ID 1)
  const ROOM_ID = 'chat_room_1'
  socket.join(ROOM_ID)
  console.log(`🔌 Client ${socket.id} joined room ${ROOM_ID}`)

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`)
  })
})


;(async () => {
  try {
    console.log('🚀 Starting Secure Chat Backend...')
    await connectDatabase()

    // 💡 4. Chạy HTTP server (đã tích hợp Socket.IO)
    httpServer.listen(PORT, () => { 
      console.log('-----------------------------------------')
      console.log(`✅ Server is listening on port ${PORT}`)
      console.log(`✅ Socket.IO is attached`)
      console.log(`✅ CORS origin allowed: ${env.CORS_ORIGINS}`)
      console.log('-----------------------------------------')
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
})()
