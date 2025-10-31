import * as React from 'react'
import { api } from '../lib/api' 
import { useAppStore } from '../app/store' 
import * as E2EE from '../lib/e2ee' 
import {
  Paper, Typography, TextField, Stack, Button, Divider,
  CircularProgress, RadioGroup, FormControlLabel, Radio
} from '@mui/material'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import EmailIcon from '@mui/icons-material/Email'

export default function Login() {
  // ---- STATE ----
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [dob, setDob] = React.useState('')
  const [gender, setGender] = React.useState<'Nam' | 'Nữ' | 'Khác'>('Nam')
  const [mode, setMode] = React.useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [needMfa, setNeedMfa] = React.useState(false) 
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')

  // State để lưu trữ identifier tạm thời khi chuyển sang màn hình 2FA
  const [pendingIdentifier, setPendingIdentifier] = React.useState('')

  const { setAccess, setUser, logout } = useAppStore()

  // ---- HELPERS ----
  const handleApiCall = async (fn: () => Promise<void>) => {
    setLoading(true)
    setError('')
    try {
      await fn()
    } catch (err: any) {
      console.error('🔴 API error:', err)
      // Thử phân tích lỗi từ Backend nếu có
      let errorMessage = err.message || 'Lỗi kết nối hoặc máy chủ.'
      try {
        // Cố gắng phân tích phản hồi lỗi JSON từ Backend
        const jsonPart = err.message.split(':: ')[1];
        if (jsonPart) {
          const jsonError = JSON.parse(jsonPart);
          if (jsonError.error) errorMessage = jsonError.error;
        }
      } catch {}
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ---- ĐĂNG KÝ (Giữ nguyên) ----
  async function register() {
    await handleApiCall(async () => {
      if (!username || !email || !password) {
        setError('Vui lòng nhập đủ tên, email và mật khẩu.')
        return
      }

      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          rawPassword: password,
          dob,
          gender,
        }),
      })

      // 🔐 Sinh cặp khóa ECDH mới sau khi đăng ký
      const keyPair = await E2EE.generateKeyPair()
      const pubB64 = await E2EE.exportPublicKey(keyPair.publicKey)
      const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
      localStorage.setItem('pubKey', pubB64)
      localStorage.setItem('privKey', JSON.stringify(privJwk))

      // 📡 Gửi publicKey thật lên server
      if (res.user?.id) {
        await api('/api/auth/update-key', {
          method: 'POST',
          body: JSON.stringify({
            user_id: res.user.id,
            public_key: pubB64,
          }),
        })
        console.log('📡 Public key đã gửi lên server khi đăng ký.')
      }

      // Thay đổi `alert` bằng thông báo trực tiếp hoặc modal nếu cần
      alert('🎉 Đăng ký thành công! Vui lòng đăng nhập.')
      setMode('login')
    })
  }

  // ---- ĐĂNG NHẬP (ĐÃ SỬA ĐỔI CHO 2FA EMAIL) ----
  async function login() {
    await handleApiCall(async () => {
      const d = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          rawPassword: password,
        }),
      })

      console.log('🟢 Login response:', d)

      // 💡 BƯỚC MỚI: KIỂM TRA YÊU CẦU 2FA
      if (d.required2fa) {
        setNeedMfa(true) // Chuyển sang màn hình nhập mã 2FA
        setPendingIdentifier(identifier) // Lưu identifier để dùng trong bước xác minh
        setPassword('') // Xóa mật khẩu đã nhập
        // ❌ Không cấp JWT và không chuyển hướng
        return 
      }

      // 🔐 TIẾP TỤC ĐĂNG NHẬP THÔNG THƯỜNG (Nếu không cần 2FA)
      const token = d.access || d.accessToken || d.access_token
      if (!token) {
        setError('Đăng nhập thất bại. Kiểm tra lại thông tin.')
        return
      }

      finalizeLogin(token, d.user)
    })
  }

  // ---- XÁC MINH 2FA EMAIL (HÀM MỚI) ----
  async function verify2FACode() {
    await handleApiCall(async () => {
      // ✅ SỬA ĐỔI: Kiểm tra code phải có đúng 6 ký tự (như đã sinh ở backend)
      if (!pendingIdentifier || code.length !== 6) {
        setError('Vui lòng nhập mã 2FA gồm 6 chữ số.')
        return
      }

      const d = await api('/api/auth/2fa/verify-email', { // Gọi API mới
        method: 'POST',
        body: JSON.stringify({
          identifier: pendingIdentifier,
          code: code,
        }),
      })

      const token = d.access || d.accessToken || d.access_token
      if (!token) {
        setError('Xác minh 2FA thất bại. Mã không hợp lệ hoặc đã hết hạn.')
        return
      }

      // ✅ Xác minh thành công, hoàn tất đăng nhập
      finalizeLogin(token, d.user)
    })
  }

  // ---- LOGIC CHUNG KẾT THÚC ĐĂNG NHẬP ----
  async function finalizeLogin(token: string, user: any) {
    setAccess(token)
    localStorage.setItem('access', token)
    if (user) {
      setUser(user)
      localStorage.setItem('user', JSON.stringify(user))
    }

    // 🔐 Nếu chưa có keypair, tạo và cập nhật lại
    const existingPub = localStorage.getItem('pubKey')
    const existingPriv = localStorage.getItem('privKey')

    if (!existingPub || !existingPriv) {
      console.log('🟢 Chưa có keypair — tạo mới...')
      const keyPair = await E2EE.generateKeyPair()
      const pubB64 = await E2EE.exportPublicKey(keyPair.publicKey)
      const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
      localStorage.setItem('pubKey', pubB64)
      localStorage.setItem('privKey', JSON.stringify(privJwk))

      if (user?.id) {
        await api('/api/auth/update-key', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user.id,
            public_key: pubB64,
          }),
        })
        console.log('📡 Public key đã cập nhật sau khi đăng nhập.')
      }
    }

    location.assign('/chat')
  }

  // ---- LOGOUT (Giữ nguyên) ----
  const handleLogout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('user')
    logout()
    location.assign('/login')
  }

  // ---- QUÊN / ĐẶT LẠI MẬT KHẨU (Giữ nguyên) ----
  async function requestResetCode() {
    await handleApiCall(async () => {
      await api('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      // Thay đổi `alert` bằng thông báo trực tiếp hoặc modal nếu cần
      alert('📧 Mã xác minh đã được gửi tới email của bạn.')
      setMode('reset')
    })
  }

  async function resetPassword() {
    await handleApiCall(async () => {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      })
      // Thay đổi `alert` bằng thông báo trực tiếp hoặc modal nếu cần
      alert('✅ Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
      setMode('login')
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      // ✅ SỬA ĐỔI LOGIC: Gọi verify2FACode nếu đang ở màn hình 2FA
      if (mode === 'login' && needMfa) {
          verify2FACode()
      } else if (mode === 'login' && !needMfa) { 
          login() // Login bình thường
      } else if (mode === 'register') {
          register()
      } else if (mode === 'forgot') {
          requestResetCode()
      } else if (mode === 'reset') {
          resetPassword()
      }
    }
  }

  // ---- UI ----
  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 480, mx: 'auto', borderRadius: 2 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <VpnKeyOutlinedIcon color="primary" sx={{ mr: 1 }} />
        {mode === 'login' && !needMfa
          ? 'Đăng nhập hệ thống'
          : mode === 'login' && needMfa
          ? 'Xác minh 2FA qua Email' // 💡 TIÊU ĐỀ MỚI CHO 2FA
          : mode === 'register'
          ? 'Đăng ký tài khoản mới'
          : mode === 'forgot'
          ? 'Quên mật khẩu'
          : 'Đặt lại mật khẩu'}
      </Typography>

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          ⚠️ {error}
        </Typography>
      )}

      <Stack component="form" spacing={2} onKeyDown={handleKeyPress}>
        {/* --------------------- HIỂN THỊ ĐĂNG KÝ --------------------- */}
        {mode === 'register' && (
          <>
            <TextField label="Tên người dùng" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Ngày sinh" type="date" value={dob} onChange={(e) => setDob(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <RadioGroup row value={gender} onChange={(e) => setGender(e.target.value as any)}>
              <FormControlLabel value="Nam" control={<Radio />} label="Nam" />
              <FormControlLabel value="Nữ" control={<Radio />} label="Nữ" />
              <FormControlLabel value="Khác" control={<Radio />} label="Khác" />
            </RadioGroup>
          </>
        )}

        {/* --------------------- HIỂN THỊ ĐĂNG NHẬP MẬT KHẨU --------------------- */}
        {mode === 'login' && !needMfa && (
          <>
            <TextField
              label="Email hoặc Tên đăng nhập"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              fullWidth
            />
            <TextField
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
          </>
        )}

        {/* --------------------- HIỂN THỊ 2FA EMAIL --------------------- */}
        {needMfa && (
          <>
            <Typography variant="body1" sx={{ mt: 1 }}>
                Mã xác minh 2FA đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.
            </Typography>
            <TextField
              label="Mã 2FA (6 chữ số)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              fullWidth
              autoFocus
            />
            <Button
              variant="contained"
              onClick={verify2FACode}
              // ✅ Đã sửa: Kiểm tra đúng 6 ký tự
              disabled={loading || code.length !== 6} 
              size="large"
              sx={{ flexGrow: 1 }}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VerifiedUserIcon />}
            >
              Xác minh và Đăng nhập
            </Button>
            <Button variant="text" onClick={() => { setNeedMfa(false); setIdentifier(pendingIdentifier); setPendingIdentifier(''); }} disabled={loading}>
              ← Quay lại
            </Button>
          </>
        )}


        {/* --------------------- HIỂN THỊ NÚT CHUNG (Đăng nhập/Đăng ký) --------------------- */}
        {(mode === 'login' || mode === 'register') && !needMfa && (
          <Stack direction="row" spacing={2} pt={1}>
            <Button
              variant="contained"
              onClick={mode === 'login' ? login : register}
              disabled={loading || (mode === 'login' && (!identifier || !password)) || (mode === 'register' && (!username || !email || !password))}
              size="large"
              sx={{ flexGrow: 1 }}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </Button>
            <Button variant="outlined" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} disabled={loading}>
              {mode === 'login' ? 'Tạo tài khoản mới' : 'Đã có tài khoản? Đăng nhập'}
            </Button>
          </Stack>
        )}


        {/* --------------------- HIỂN THỊ QUÊN/RESET MẬT KHẨU --------------------- */}

        {mode === 'forgot' && (
          <>
            <TextField
              label="Nhập Email của bạn"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<EmailIcon />}
              onClick={requestResetCode}
              disabled={loading || !email}
            >
              Gửi mã xác minh
            </Button>
          </>
        )}

        {mode === 'reset' && (
          <>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth disabled />
            <TextField label="Mã xác minh" value={code} onChange={(e) => setCode(e.target.value)} fullWidth />
            <TextField label="Mật khẩu mới" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth />
            <Button
              variant="contained"
              onClick={resetPassword}
              disabled={loading || !code || !newPassword}
            >
              Đổi mật khẩu
            </Button>
          </>
        )}


        {/* --------------------- FOOTER LINKS --------------------- */}
        {mode === 'login' && !needMfa && (
          <Button variant="text" color="primary" onClick={() => setMode('forgot')}>
            Quên mật khẩu?
          </Button>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <Button variant="text" onClick={() => setMode('login')}>
            ← Quay lại đăng nhập
          </Button>
        )}
      </Stack>

      {/* ❌ ĐÃ XÓA: Khối UI TOTP cũ */}
    </Paper>
  )
}
