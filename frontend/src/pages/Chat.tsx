import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../app/store'
import { api } from '../lib/api'
import * as E2EE from '../lib/e2ee'
import { io, Socket } from 'socket.io-client' // 💡 Import Socket.IO Client

export default function ChatPage() {
  const { user, setUser, logout } = useAppStore()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const chatBoxRef = useRef<HTMLDivElement>(null)
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null)
  const [loadingMfa, setLoadingMfa] = useState(false)

  // 💡 STATE MỚI: Trạng thái 2FA hiện tại của người dùng
  const [mfaStatus, setMfaStatus] = useState(user?.mfaEnabled ?? false)

  // 💡 Socket.IO Ref
  const socketRef = useRef<Socket | null>(null)

  const roomId = 1
  const peerId = 2

  // ⚙️ HELPERS: Tự động cuộn xuống dưới cùng
  const scrollToBottom = () => {
    setTimeout(() => {
      chatBoxRef.current?.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }, 50)
  }

  // 💡 HÀM MỚI: Xử lý tin nhắn đến từ Socket.IO
  const handleNewMessage = useCallback(async (msg: any) => {
    const k = aesKey // Sử dụng AES key hiện tại
    if (k) {
      try {
        msg.plaintext = await E2EE.decryptMessage(k, msg.ciphertext, msg.iv)
      } catch {
        msg.plaintext = '(Không thể giải mã)'
      }
    }
    // Thêm tin nhắn mới vào đầu danh sách
    setMessages((prevMsgs) => [...prevMsgs, msg])
    scrollToBottom()
  }, [aesKey])

  // 🧠 Khởi tạo E2EE (Giữ nguyên logic chính)
  async function initE2EE(): Promise<CryptoKey | null> {
    try {
      console.log('🟠 Bắt đầu khởi tạo E2EE...')
      // ... (Logic khởi tạo và lấy AES key giữ nguyên)
      const savedAes = sessionStorage.getItem(`aesKey:${roomId}`)
      if (savedAes) {
        const imported = await E2EE.importAesKey(savedAes)
        setAesKey(imported)
        console.log('✅ AES key loaded from sessionStorage')
        return imported
      }
      
      let myKeyPair: E2EE.KeyPair
      const savedPriv = localStorage.getItem('privKey')
      const savedPub = localStorage.getItem('pubKey')

      if (!savedPriv || !savedPub) {
        myKeyPair = await E2EE.generateKeyPair()
        const pubB64 = await E2EE.exportPublicKey(myKeyPair.publicKey)
        const privJwk = await crypto.subtle.exportKey('jwk', myKeyPair.privateKey)
        localStorage.setItem('pubKey', pubB64)
        localStorage.setItem('privKey', JSON.stringify(privJwk))
        console.log('🟢 Sinh cặp khóa mới:', pubB64)

        if (user?.id) {
          await api('/api/auth/update-key', {
            method: 'POST',
            body: JSON.stringify({ user_id: user.id, public_key: pubB64 }),
          })
          console.log('📡 Public key đã cập nhật lên server.')
        }
      } else {
        const privJwk = JSON.parse(savedPriv)
        const pubKey = await E2EE.importPublicKey(savedPub)
        const privKey = await crypto.subtle.importKey(
          'jwk',
          privJwk,
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey', 'deriveBits']
        )
        myKeyPair = { publicKey: pubKey, privateKey: privKey }
      }

      const peerRes = await api(`/api/auth/public-key/${peerId}`)
      const peerPubB64 = peerRes.public_key
      if (!peerPubB64) throw new Error('Không tìm thấy public key của người nhận')
      const peerPub = await E2EE.importPublicKey(peerPubB64)

      const aes = await E2EE.deriveAesKey(myKeyPair.privateKey, peerPub)
      const exported = await E2EE.exportAesKey(aes)
      sessionStorage.setItem(`aesKey:${roomId}`, exported)
      setAesKey(aes)
      console.log('✅ Hoàn tất — AES session key derived & saved!')

      return aes
    } catch (err) {
      console.error('❌ initE2EE error:', err)
      alert('Lỗi khởi tạo E2EE: ' + (err as Error).message)
      return null
    }
  }

  // ⚙️ HÀM MỚI: Bật/Tắt 2FA (Giữ nguyên)
  async function toggleMfa(enable: boolean) {
    if (!user?.id) return
    setLoadingMfa(true)
    try {
      const res = await api('/api/auth/toggle-mfa', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, enable }),
      })

      if (res.mfaEnabled !== undefined) {
        setMfaStatus(res.mfaEnabled)
        const updatedUser = { ...user, mfaEnabled: res.mfaEnabled }
        setUser(updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
        alert(`Đã ${res.mfaEnabled ? 'BẬT' : 'TẮT'} 2FA Email thành công.`)
      }
    } catch (err) {
      console.error('❌ Toggle MFA error:', err)
      alert('Cập nhật 2FA thất bại. Vui lòng thử lại.')
      setMfaStatus(!enable)
    } finally {
      setLoadingMfa(false)
    }
  }

  // 📨 Giải mã tin nhắn khi tải (Chỉ dùng cho lịch sử ban đầu)
  async function loadMessages(key?: CryptoKey) {
    try {
      const res = await api(`/api/chat/history/${roomId}`)
      const msgs = res.messages || []
      const k = key || aesKey

      if (k) {
        for (const m of msgs) {
          try {
            m.plaintext = await E2EE.decryptMessage(k, m.ciphertext, m.iv)
          } catch {
            m.plaintext = '(Không thể giải mã)'
          }
        }
      }

      setMessages(msgs)
      scrollToBottom()
    } catch (err) {
      console.error('❌ loadMessages error:', err)
    }
  }

  // 💬 Gửi tin nhắn (XÓA POLLING)
  async function sendMessage() {
    try {
      if (!text.trim()) return
      if (!aesKey) {
        alert('⚠️ Chưa sẵn sàng AES key. Hãy chờ vài giây và thử lại.')
        return
      }

      const { ciphertext, iv } = await E2EE.encryptMessage(aesKey, text)
      await api('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          senderId: user?.id || 0,
          ciphertext,
          iv,
        }),
      })

      setText('')
      // ❌ ĐÃ XÓA: await loadMessages(aesKey) - Vì Socket.IO sẽ tự động thêm tin nhắn
    } catch (err) {
      console.error('❌ sendMessage error:', err)
      alert('Gửi tin nhắn thất bại.')
    }
  }
  
  // 💡 EFFECT MỚI: Kết nối và Nghe Socket.IO
  useEffect(() => {
    if (aesKey) {
      // Kết nối tới server Socket.IO. Giả định server chạy cùng host/port với Vite
      const newSocket = io('http://localhost:4000', {
        // Gửi JWT nếu cần xác thực Socket.IO
        auth: { token: localStorage.getItem('access') },
      })

      socketRef.current = newSocket

      newSocket.on('connect', () => {
        console.log('🔌 Socket.IO Connected:', newSocket.id)
      })

      // Đăng ký nghe sự kiện tin nhắn mới
      newSocket.on('new_message', handleNewMessage)

      newSocket.on('disconnect', () => {
        console.log('🔌 Socket.IO Disconnected')
      })

      newSocket.on('connect_error', (err) => {
        console.error('🔌 Socket.IO Connection Error:', err.message)
      })

      // Dọn dẹp khi component unmount
      return () => {
        newSocket.off('new_message', handleNewMessage)
        newSocket.close()
      }
    }
  }, [aesKey, handleNewMessage]) // Kết nối lại khi AES key sẵn sàng

  // 🚀 Khởi tạo tổng hợp
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedAccess = localStorage.getItem('access')

    if (storedUser && !user) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        setMfaStatus(parsedUser.mfaEnabled ?? false)
      } catch {
        console.warn('⚠️ Không thể parse user từ localStorage')
      }
    }

    if (storedAccess) {
      ;(async () => {
        const aes = await initE2EE()
        if (aes) await loadMessages(aes)
      })()
    }
  }, [user]) // Chạy lại khi user thay đổi (đã đăng nhập)


  const formatTime = (ts: string | Date) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour12: false })

  return (
    <div style={{ background: '#111', color: '#fff', height: '100vh', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontWeight: 'bold', color: '#7dd3fc' }}>💬 Phòng: General Chat</span>
          <span
            style={{
              marginLeft: '1rem',
              color: aesKey ? '#22c55e' : '#f43f5e',
              fontSize: '0.9rem',
            }}
          >
            {aesKey ? '🔐 E2E mã hóa bật' : '⚠️ AES chưa sẵn sàng'}
          </span>
        </div>
        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              
              {/* ⚙️ UI: Toggle 2FA */}
              <label style={{ display: 'flex', alignItems: 'center', cursor: loadingMfa ? 'wait' : 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={mfaStatus} 
                  onChange={(e) => toggleMfa(e.target.checked)}
                  disabled={loadingMfa}
                  style={{ marginRight: '0.4rem', transform: 'scale(1.2)' }}
                />
                {loadingMfa ? 'Đang cập nhật...' : (mfaStatus ? '2FA ĐANG BẬT' : 'BẬT 2FA Email')}
              </label>

              <span>👋 Xin chào, <b>{user.username || user.email}</b></span>
              <button
                onClick={logout}
                style={{
                  background: '#f43f5e',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <span style={{ color: '#aaa' }}>Chưa đăng nhập</span>
          )}
        </div>
      </div>

      {/* Chat box */}
      <div
        ref={chatBoxRef}
        style={{
          background: '#1e1e1e',
          padding: '1rem',
          borderRadius: '10px',
          height: '70vh',
          overflowY: 'auto',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && <p style={{ color: '#aaa' }}>Chưa có tin nhắn.</p>}

        {messages.map((m) => {
          const isMine = user && m.sender_id === user.id
          // Sử dụng m.sender?.username hoặc m.sender.username
          const senderName = m.sender?.username || (m.sender && m.sender.username) || `#${m.sender_id}`

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
                marginBottom: '0.5rem',
              }}
            >
              <div
                style={{
                  background: isMine ? '#3b82f6' : '#374151',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  maxWidth: '70%',
                  wordWrap: 'break-word',
                }}
              >
                <div>{m.plaintext || m.ciphertext}</div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#ccc',
                    marginTop: '4px',
                    textAlign: isMine ? 'right' : 'left',
                  }}
                >
                  {senderName} • {formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()} // Gửi tin nhắn bằng Enter
          placeholder="Nhập tin nhắn..."
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #333',
            background: '#222',
            color: '#fff',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Gửi
        </button>
      </div>
    </div>
  )
}
