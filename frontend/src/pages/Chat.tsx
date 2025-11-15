// components/ChatPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../app/store'
import { api } from '../lib/api'
import * as E2EE from '../lib/e2ee'
import { encryptWithPFS } from '../lib/pfs'
import { io, Socket } from 'socket.io-client'

interface Message {
  id: number
  sender_id: number
  ciphertext: string
  iv: string
  signature: string
  ephemeralPubKey: string
  createdAt: string
  plaintext?: string
  sender?: { id: number; username: string; email: string }
}

export default function ChatPage() {
  const { user, setUser, logout } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const chatBoxRef = useRef<HTMLDivElement>(null)
  const [loadingMfa, setLoadingMfa] = useState(false)
  const [mfaStatus, setMfaStatus] = useState(user?.mfaEnabled ?? false)
  const socketRef = useRef<Socket | null>(null)

  const roomId = 1
  const peerId = 2

  // === HELPERS ===
  const scrollToBottom = () => {
    setTimeout(() => {
      chatBoxRef.current?.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }, 50)
  }

  const formatTime = (ts: string | Date) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour12: false })

  // === GIẢI MÃ PFS + XÁC MINH CHỮ KÝ ===
  const decryptPFSMessage = useCallback(
    async (msg: Message): Promise<string> => {
      try {
        const myEcdhPrivJwk = localStorage.getItem('ecdh_priv')
        if (!myEcdhPrivJwk) throw new Error('Không có ECDH private key')

        // 1. Lấy ECDSA public key người gửi để xác minh chữ ký
        const peerRes = await api(`/api/auth/public-key/${msg.sender_id}`)
        const senderPubKeyB64 = peerRes.public_key
        if (!senderPubKeyB64) throw new Error('Không có public key người gửi')

        const senderPubKey = await E2EE.importEcdsaPublicKey(senderPubKeyB64)

        // 2. Xác minh chữ ký
        const dataToVerify = `${msg.ciphertext}:${msg.iv}`
        const isVerified = await E2EE.verifySignature(senderPubKey, dataToVerify, msg.signature)
        if (!isVerified) throw new Error('Chữ ký không hợp lệ')

        // 3. Giải mã PFS
        const privKey = await crypto.subtle.importKey(
          'jwk',
          JSON.parse(myEcdhPrivJwk),
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          ['deriveKey', 'deriveBits']
        )

        const peerPub = await E2EE.importEcdhPublicKey(msg.ephemeralPubKey)
        const aesKey = await E2EE.deriveAesKey(privKey, peerPub)
        return await E2EE.decryptMessage(aesKey, msg.ciphertext, msg.iv)

      } catch (err) {
        console.error('Decrypt error:', err)
        return `(Lỗi: ${(err as Error).message})`
      }
    },
    []
  )

  // === XỬ LÝ TIN NHẮN MỚI ===
  const handleNewMessage = useCallback(
    async (msg: Message) => {
      if (!msg.signature) {
        msg.plaintext = '(Thiếu chữ ký)'
      } else {
        msg.plaintext = await decryptPFSMessage(msg)
      }
      setMessages(prev => [...prev, msg])
      scrollToBottom()
    },
    [decryptPFSMessage]
  )

  // === TẢI LỊCH SỬ ===
  const loadMessages = useCallback(async () => {
    try {
      const res = await api(`/api/chat/history/${roomId}`)
      const msgs: Message[] = res.messages || []

      for (const m of msgs) {
        if (!m.signature) {
          m.plaintext = '(Thiếu chữ ký)'
          continue
        }
        m.plaintext = await decryptPFSMessage(m)
      }

      setMessages(msgs)
      scrollToBottom()
    } catch (err) {
      console.error('Lỗi tải tin:', err)
    }
  }, [decryptPFSMessage])

  // === GỬI TIN NHẮN ===
  const sendMessage = async () => {
    if (!text.trim() || !user?.id) return

    try {
      const peerRes = await api(`/api/auth/public-key/${peerId}`)
      const peerEcdhPub = peerRes.public_key // ECDSA pub? → CẦN SỬA BACKEND
      if (!peerEcdhPub) throw new Error('Không có public key')

      const ecdsaPrivJwk = localStorage.getItem('ecdsa_priv')
      if (!ecdsaPrivJwk) throw new Error('Không có ECDSA private key')

      const pfs = await encryptWithPFS(text, peerEcdhPub, JSON.parse(ecdsaPrivJwk))

      await api('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ roomId, ...pfs }),
      })

      setText('')
    } catch (err) {
      alert('Gửi thất bại: ' + (err as Error).message)
    }
  }

  // === TOGGLE 2FA ===
  const toggleMfa = async (enable: boolean) => {
    if (!user?.id) return
    setLoadingMfa(true)
    try {
      const res = await api('/api/auth/toggle-mfa', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, enable }),
      })

      if (res.mfaEnabled !== undefined) {
        setMfaStatus(res.mfaEnabled)
        const updated = { ...user, mfaEnabled: res.mfaEnabled }
        setUser(updated)
        localStorage.setItem('user', JSON.stringify(updated))
        alert(`2FA Email đã ${res.mfaEnabled ? 'BẬT' : 'TẮT'}`)
      }
    } catch (err) {
      alert('Cập nhật thất bại')
    } finally {
      setLoadingMfa(false)
    }
  }

  // === KHỞI TẠO KEY + SOCKET ===
  useEffect(() => {
    const init = async () => {
      // Khôi phục user
      const stored = localStorage.getItem('user')
      if (stored && !user) {
        const parsed = JSON.parse(stored)
        setUser(parsed)
        setMfaStatus(parsed.mfaEnabled ?? false)
      }

      // Tạo key pair nếu chưa có
      if (!localStorage.getItem('ecdsa_priv') && user?.id) {
        const ecdh = await E2EE.generateEcdhKeyPair()
        const ecdsa = await E2EE.generateEcdsaKeyPair()

        const ecdhPub = await E2EE.exportPublicKey(ecdh.publicKey)
        const ecdsaPub = await E2EE.exportPublicKey(ecdsa.publicKey)
        const ecdhPriv = await crypto.subtle.exportKey('jwk', ecdh.privateKey)
        const ecdsaPriv = await crypto.subtle.exportKey('jwk', ecdsa.privateKey)

        localStorage.setItem('ecdh_pub', ecdhPub)
        localStorage.setItem('ecdsa_pub', ecdsaPub)
        localStorage.setItem('ecdh_priv', JSON.stringify(ecdhPriv))
        localStorage.setItem('ecdsa_priv', JSON.stringify(ecdsaPriv))

        // Chỉ gửi ECDSA public key
        await api('/api/auth/update-key', {
          method: 'POST',
          body: JSON.stringify({ user_id: user.id, public_key: ecdsaPub }),
        })
      }

      await loadMessages()
    }

    init()
  }, [user, loadMessages, setUser])

  // === SOCKET.IO ===
  useEffect(() => {
    const token = localStorage.getItem('access')
    if (!token) return

    const socket = io('http://localhost:4000', { auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected')
      socket.emit('join_room', roomId)
    })

    socket.on('new_message', handleNewMessage)
    socket.on('connect_error', err => console.error('Socket error:', err.message))

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.close()
    }
  }, [handleNewMessage])

  // === RENDER ===
  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontWeight: 'bold', color: '#7dd3fc' }}>Phòng: General Chat</span>
          <span style={{ marginLeft: '1rem', color: '#22c55e', fontSize: '0.9rem' }}>
            L2 PFS + E2EE + Signature
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: loadingMfa ? 'wait' : 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={mfaStatus}
              onChange={e => toggleMfa(e.target.checked)}
              disabled={loadingMfa}
              style={{ marginRight: '0.4rem', transform: 'scale(1.2)' }}
            />
            {loadingMfa ? 'Đang cập nhật...' : mfaStatus ? '2FA BẬT' : 'BẬT 2FA'}
          </label>

          <span>Chào, <b>{user?.username || user?.email}</b></span>
          <button onClick={logout} style={{ background: '#f43f5e', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px' }}>
            Đăng xuất
          </button>
        </div>
      </div>

      <div
        ref={chatBoxRef}
        style={{
          background: '#1e1e1e',
          padding: '1rem',
          borderRadius: '10px',
          height: '65vh',
          overflowY: 'auto',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: '#aaa' }}>Chưa có tin nhắn.</p>
        ) : (
          messages.map(m => {
            const isMine = user && m.sender_id === user.id
            const senderName = m.sender?.username || `#${m.sender_id}`

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
                  <div>{m.plaintext || '(Đang giải mã...)'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#ccc', marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                    {senderName} • {formatTime(m.createdAt)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
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
          }}
        >
          Gửi
        </button>
      </div>
    </div>
  )
}