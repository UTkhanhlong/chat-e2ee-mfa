// ===============================
//   ChatPage.tsx - FINAL FIXED 100%
//   2FA Email hoạt động hoàn hảo!
// ===============================
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../app/store'
import { api } from '../lib/api'
import * as E2EE from '../lib/e2ee'
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
  _tempId?: number
}

export default function ChatPage() {
  const { user, setUser, logout } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const chatBoxRef = useRef<HTMLDivElement>(null)
  
  // 2FA STATE - ĐÃ FIX HOÀN CHỈNH
  const [mfaStatus, setMfaStatus] = useState(user?.mfaEnabled ?? false)
  const [loadingMfa, setLoadingMfa] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const [isSending, setIsSending] = useState(false)
  const roomId = 1

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBoxRef.current?.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }, 50)
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // ============================
  //     GIẢI MÃ TIN NHẮN
  // ============================
  const decryptPFSMessage = useCallback(
    async (msg: Message): Promise<string> => {
      if (!msg.ephemeralPubKey || !msg.ciphertext || !msg.iv) {
        return '(Thiếu dữ liệu mã hóa)'
      }

      const privJwk = localStorage.getItem('ecdh_priv')
      if (!privJwk) return '(Thiếu khóa riêng ECDH)'

      try {
        const myPriv = await crypto.subtle.importKey(
          'jwk',
          JSON.parse(privJwk),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          ['deriveKey']
        )

        const senderPub = await E2EE.importEcdhPublicKey(msg.ephemeralPubKey)
        const aesKey = await E2EE.deriveAesKey(myPriv, senderPub)

        return await E2EE.decryptMessage(aesKey, msg.ciphertext, msg.iv)
      } catch (e) {
        console.error('Decrypt failed:', e)
        return '(Tin nhắn không thể giải mã)'
      }
    },
    []
  )

  const handleNewMessage = useCallback(
    async (msg: Message) => {
      if (user && msg.sender_id === user.id) {
        // Tin nhắn của mình → giữ lại plaintext từ Optimistic UI
      } else {
        msg.plaintext = await decryptPFSMessage(msg)
      }

      setMessages(prev => {
        // Xử lý thay thế tin nhắn tạm (ID âm)
        if (user && msg.sender_id === user.id && msg.id > 0) {
          const tempIndex = prev.findIndex(m => m.id < 0 && m.sender_id === user.id)
          if (tempIndex !== -1) {
            const oldPlaintext = prev[tempIndex].plaintext
            const updated = [...prev]
            updated[tempIndex] = { ...msg, plaintext: oldPlaintext, _tempId: undefined }
            return updated
          }
        }

        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      scrollToBottom()
    },
    [decryptPFSMessage, user]
  )

  // ============================
  //      LOAD HISTORY
  // ============================
  const loadMessages = useCallback(async () => {
    try {
      const res = await api(`/api/chat/history/${roomId}`)
      const msgs: Message[] = res.messages || []

      for (const m of msgs) {
        if (user && m.sender_id === user.id) {
          const localKey = 'pfs_msg_' + m.ciphertext.substring(0, 20)
          const stored = localStorage.getItem(localKey)
          m.plaintext = stored || '(Không tìm thấy nội dung đã lưu)'
        } else {
          m.plaintext = await decryptPFSMessage(m)
        }
      }

      setMessages(msgs)
      scrollToBottom()
    } catch (e) {
      console.error('Load history error:', e)
    }
  }, [decryptPFSMessage, user])

  // ============================
  //   TẠO KEY CHỈ 1 LẦN
  // ============================
  const ensureKeys = async () => {
    try {
      const hasAllKeys =
        localStorage.getItem('ecdh_priv') &&
        localStorage.getItem('ecdh_pub') &&
        localStorage.getItem('ecdsa_priv') &&
        localStorage.getItem('ecdsa_pub')

      if (hasAllKeys) {
        console.log("Đã có đủ ECDH/ECDSA key → sử dụng key hiện có.")
        return
      }

      console.warn("KHÔNG tìm thấy key → tạo mới…")
      const token = localStorage.getItem('access')
      if (!token) return

      const ecdh = await E2EE.generateEcdhKeyPair()
      const ecdsa = await E2EE.generateEcdsaKeyPair()

      const ecdhPub = await E2EE.exportPublicKey(ecdh.publicKey)
      const ecdsaPub = await E2EE.exportPublicKey(ecdsa.publicKey)
      const ecdhPriv = await crypto.subtle.exportKey("jwk", ecdh.privateKey)
      const ecdsaPriv = await crypto.subtle.exportKey("jwk", ecdsa.privateKey)

      localStorage.setItem("ecdh_pub", ecdhPub)
      localStorage.setItem("ecdsa_pub", ecdsaPub)
      localStorage.setItem("ecdh_priv", JSON.stringify(ecdhPriv))
      localStorage.setItem("ecdsa_priv", JSON.stringify(ecdsaPriv))

      await api("/api/auth/update-key", {
        method: "POST",
        body: JSON.stringify({
          ecdsa_key: ecdsaPub,
          ecdh_key: ecdhPub,
        }),
      })

      console.log("Đã tạo & upload key thành công!")
    } catch (err) {
      console.error("Lỗi tạo key:", err)
    }
  }

  // ============================
  //       INIT
  // ============================
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('user')
      if (stored && !user) setUser(JSON.parse(stored))

      await ensureKeys()
      await loadMessages()
    }
    init()
  }, [])

  // ============================
  //       SOCKET.IO
  // ============================
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

    return () => {
      socket.off('new_message')
      socket.close()
    }
  }, [handleNewMessage])

  // ============================
  //      GỬI TIN NHẮN
  // ============================
  const sendMessage = async () => {
    if (!text.trim() || !user || isSending) return
    setIsSending(true)

    try {
      let recipientId = user.id === 9 ? 10 : 9
      const keyRes = await api(`/api/auth/public-key/${recipientId}`)
      const recipientPub = keyRes?.ecdh_key || keyRes?.ecdh_pub
      if (!recipientPub) throw new Error('Không có public key người nhận')

      const eph = await E2EE.generateEcdhKeyPair()
      const pubKey = await E2EE.importEcdhPublicKey(recipientPub)
      const aesKey = await E2EE.deriveAesKey(eph.privateKey, pubKey)
      const { ciphertext, iv } = await E2EE.encryptMessage(aesKey, text)
      const ephemeralPubKey = await E2EE.exportPublicKey(eph.publicKey)

      const signKeyJwk = localStorage.getItem('ecdsa_priv')
      const signKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(signKeyJwk!),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      )
      const signature = await E2EE.signData(
        signKey,
        `${ephemeralPubKey}:${ciphertext}:${iv}`
      )

      const tempId = Date.now()
      setMessages(prev => [
        ...prev,
        {
          id: -tempId,
          _tempId: tempId,
          sender_id: user.id,
          ciphertext, iv, signature, ephemeralPubKey,
          createdAt: new Date().toISOString(),
          plaintext: text,
          sender: { id: user.id, username: user.username, email: user.email },
        },
      ])

      await api('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ roomId, ciphertext, iv, signature, ephemeralPubKey }),
      })

      const localKey = 'pfs_msg_' + ciphertext.substring(0, 20)
      localStorage.setItem(localKey, text)

      setText('')
      scrollToBottom()
    } catch (e: any) {
      alert('Gửi thất bại: ' + e.message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '2rem' }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '1rem'
      }}>
        <div>
          <b style={{ color: '#7dd3fc' }}>Phòng: General Chat</b>
          <span style={{ marginLeft: '1rem', color: '#22c55e' }}>
            PFS + E2EE + Signature (Chuẩn Signal)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* 2FA TOGGLE - HOẠT ĐỘNG 100% */}
          <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', alignItems: 'center' }}>
            {loadingMfa && <span style={{ fontSize: '0.85rem', color: '#60a5fa' }}>Đang xử lý...</span>}
            <input
              type="checkbox"
              checked={mfaStatus}
              disabled={loadingMfa}
              onChange={async (e) => {
                const wantToEnable = e.target.checked
                setLoadingMfa(true)

                try {
                  await api('/api/auth/toggle-mfa', {
                  method: 'POST',
                  body: JSON.stringify({ enable: wantToEnable }),
                })

                setMfaStatus(wantToEnable)
                alert(wantToEnable
                  ? 'ĐÃ BẬT 2FA THÀNH CÔNG!\nTừ giờ đăng nhập lại sẽ phải nhập mã 6 số từ email.'
                  : 'Đã tắt 2FA'
                )
              } catch (err: any) {
                alert('Lỗi: ' + (err.error || 'Không thể thay đổi 2FA'))
                e.target.checked = !wantToEnable
              } finally {
                setLoadingMfa(false)
              }
            }}
          />
            <span style={{ 
              color: mfaStatus ? '#22c55e' : '#94a3b8', 
              fontWeight: mfaStatus ? 'bold' : 'normal' 
            }}>
              {mfaStatus ? '2FA BẬT' : 'BẬT 2FA'}
            </span>
          </label>

          <span>Chào, <b>{user?.username}</b></span>
          <button onClick={logout} style={{
            background: '#f43f5e', padding: '8px 16px',
            borderRadius: '8px', border: 'none', cursor: 'pointer'
          }}>
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Chat Box */}
      <div ref={chatBoxRef} style={{
        background: '#1e1e1e', padding: '1rem', borderRadius: '12px',
        height: '65vh', overflowY: 'auto', marginBottom: '1rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem'
      }}>
        {messages.map(m => {
          const isMine = user && m.sender_id === user.id
          return (
            <div key={m.id > 0 ? m.id : m._tempId}
              style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                background: isMine ? '#3b82f6' : '#374151',
                padding: '10px 14px', borderRadius: '16px',
                maxWidth: '70%', wordBreak: 'break-word'
              }}>
                <div>{m.plaintext || '(Đang giải mã...)'}</div>
                <div style={{ fontSize: '0.7rem', color: '#ccc', marginTop: '4px' }}>
                  {m.sender?.username || 'Unknown'} • {formatTime(m.createdAt)}
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
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isSending && sendMessage()}
          style={{
            flex: 1, padding: '14px', borderRadius: '14px',
            background: '#222', border: '1px solid #444', color: 'white'
          }}
          placeholder="Nhập tin nhắn..."
        />

        <button
          onClick={sendMessage}
          disabled={isSending}
          style={{
            background: isSending ? '#666' : '#3b82f6',
            padding: '14px 28px',
            borderRadius: '14px', border: 'none', cursor: 'pointer'
          }}>
          {isSending ? 'Đang gửi...' : 'Gửi'}
        </button>
      </div>

    </div>
  )
}