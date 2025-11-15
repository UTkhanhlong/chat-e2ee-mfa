// src/pages/Login.tsx
import * as React from 'react'
import { api } from '../lib/api'
import { useAppStore } from '../app/store'
import * as E2EE from '../lib/e2ee'
import {
  Paper, Typography, TextField, Stack, Button, Alert, CircularProgress,
  RadioGroup, FormControlLabel, Radio, InputAdornment, Box
} from '@mui/material'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import EmailIcon from '@mui/icons-material/Email'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function Login() {
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [dob, setDob] = React.useState('')
  const [gender, setGender] = React.useState<'Nam' | 'Nữ' | 'Khác'>('Nam')
  const [mode, setMode] = React.useState<'login' | 'register' | 'forgot' | 'reset' | '2fa'>('login')
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [pendingIdentifier, setPendingIdentifier] = React.useState('')

  const { setAccess, setUser } = useAppStore()

  const handleApiCall = async (fn: () => Promise<void>) => {
    setLoading(true)
    setError('')
    try {
      await fn()
    } catch (err: any) {
      console.error('API error:', err)
      let msg = 'Lỗi kết nối hoặc máy chủ.'
      try {
        const json = JSON.parse(err.message.split(':: ')[1] || '{}')
        msg = json.error || json.message || msg
      } catch {}
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const finalizeLogin = async (token: string, userData: any) => {
    setAccess(token)
    localStorage.setItem('access', token)
    if (userData) {
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
    }

    if (!localStorage.getItem('ecdsa_priv')) {
      const ecdhPair = await E2EE.generateEcdhKeyPair()
      const ecdsaPair = await E2EE.generateEcdsaKeyPair()

      const ecdhPub = await E2EE.exportPublicKey(ecdhPair.publicKey)
      const ecdsaPub = await E2EE.exportPublicKey(ecdsaPair.publicKey)
      const ecdhPriv = await crypto.subtle.exportKey('jwk', ecdhPair.privateKey)
      const ecdsaPriv = await crypto.subtle.exportKey('jwk', ecdsaPair.privateKey)

      localStorage.setItem('ecdh_pub', ecdhPub)
      localStorage.setItem('ecdsa_pub', ecdsaPub)
      localStorage.setItem('ecdh_priv', JSON.stringify(ecdhPriv))
      localStorage.setItem('ecdsa_priv', JSON.stringify(ecdsaPriv))

      await api('/api/auth/update-key', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userData.id,
          ecdsa_key: ecdsaPub,
        }),
      })
    }

    location.assign('/chat')
  }

  const register = async () => {
    await handleApiCall(async () => {
      if (!username || !email || !password) {
        setError('Vui lòng nhập đủ thông tin.')
        return
      }

      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, rawPassword: password, dob, gender }),
      })

      if (res.access && res.user) {
        await finalizeLogin(res.access, res.user)
      } else {
        setError('Đăng ký thất bại.')
      }
    })
  }

  const login = async () => {
    await handleApiCall(async () => {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, rawPassword: password }),
      })

      if (res.required2fa) {
        setPendingIdentifier(identifier)
        setPassword('')
        setMode('2fa')
        return
      }

      if (res.access && res.user) {
        await finalizeLogin(res.access, res.user)
      } else {
        setError('Đăng nhập thất bại.')
      }
    })
  }

  const verify2FA = async () => {
    await handleApiCall(async () => {
      if (code.length !== 6) {
        setError('Mã 2FA phải có 6 ký tự.')
        return
      }

      const res = await api('/api/auth/2fa/verify-email', {
        method: 'POST',
        body: JSON.stringify({ identifier: pendingIdentifier, code }),
      })

      if (res.access && res.user) {
        await finalizeLogin(res.access, res.user)
      } else {
        setError('Mã 2FA không hợp lệ hoặc đã hết hạn.')
      }
    })
  }

  const requestReset = async () => {
    await handleApiCall(async () => {
      await api('/api/auth/request-reset', { method: 'POST', body: JSON.stringify({ email }) })
      alert('Mã đã được gửi đến email.')
      setMode('reset')
    })
  }

  const resetPassword = async () => {
    await handleApiCall(async () => {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      })
      alert('Đặt lại mật khẩu thành công!')
      setMode('login')
      setEmail('')
      setCode('')
      setNewPassword('')
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      if (mode === '2fa') verify2FA()
      else if (mode === 'login') login()
      else if (mode === 'register') register()
      else if (mode === 'forgot') requestReset()
      else if (mode === 'reset') resetPassword()
    }
  }

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 480, mx: 'auto', borderRadius: 2 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <VpnKeyOutlinedIcon color="primary" sx={{ mr: 1 }} />
        {mode === '2fa' ? 'Xác minh 2FA' : 
         mode === 'register' ? 'Đăng ký tài khoản mới' : 
         mode === 'forgot' ? 'Quên mật khẩu' : 
         mode === 'reset' ? 'Đặt lại mật khẩu' : 'Đăng nhập'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack component="form" spacing={2} onKeyDown={handleKeyPress}>
        {mode === 'register' && (
          <>
            <TextField label="Tên người dùng" value={username} onChange={e => setUsername(e.target.value)} fullWidth autoFocus />
            <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} fullWidth />
            <TextField label="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth />
            <TextField label="Ngày sinh" type="date" value={dob} onChange={e => setDob(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <RadioGroup row value={gender} onChange={e => setGender(e.target.value as any)}>
              <FormControlLabel value="Nam" control={<Radio />} label="Nam" />
              <FormControlLabel value="Nữ" control={<Radio />} label="Nữ" />
              <FormControlLabel value="Khác" control={<Radio />} label="Khác" />
            </RadioGroup>
          </>
        )}

        {mode === 'login' && (
          <>
            <TextField label="Email hoặc tên đăng nhập" value={identifier} onChange={e => setIdentifier(e.target.value)} fullWidth autoFocus />
            <TextField label="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} fullWidth />
          </>
        )}

        {/* 2FA – CHỮ + SỐ (HEX) */}
        {mode === '2fa' && (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="info" icon={<EmailIcon />} sx={{ mb: 3, textAlign: 'left' }}>
              Mã xác minh 2FA đã được gửi đến: <strong>{pendingIdentifier}</strong>
              <br />
              Vui lòng kiểm tra hộp thư (bao gồm <strong>Spam/Junk</strong>).
            </Alert>

            <TextField
              label="Mã 2FA (6 ký tự)"
              value={code}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6)
                setCode(value)
              }}
              inputProps={{ maxLength: 6 }}
              fullWidth
              autoFocus
              placeholder="A1B2C3"
              sx={{
                mb: 2,
                '& input': {
                  textAlign: 'center',
                  fontSize: '2rem',
                  letterSpacing: '0.5rem',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: '#1976d2',
                },
              }}
              InputProps={{
                endAdornment: code.length === 6 && (
                  <InputAdornment position="end">
                    <VerifiedUserIcon color="success" fontSize="large" />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              onClick={verify2FA}
              disabled={loading || code.length !== 6}
              size="large"
              fullWidth
              sx={{ mb: 1, py: 1.5 }}
              startIcon={loading ? <CircularProgress size={20} /> : <VerifiedUserIcon />}
            >
              {loading ? 'Đang xác minh...' : 'Xác minh & Đăng nhập'}
            </Button>

            <Button
              variant="text"
              onClick={() => {
                setMode('login')
                setCode('')
                setError('')
              }}
              disabled={loading}
              startIcon={<ArrowBackIcon />}
              fullWidth
            >
              Quay lại đăng nhập
            </Button>
          </Box>
        )}

        {(mode === 'login' || mode === 'register') && (
          <Stack direction="row" spacing={2} pt={1}>
            <Button
              variant="contained"
              onClick={mode === 'login' ? login : register}
              disabled={loading || 
                (mode === 'login' && (!identifier || !password)) || 
                (mode === 'register' && (!username || !email || !password))
              }
              size="large"
              sx={{ flexGrow: 1 }}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </Button>
            <Button variant="outlined" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} disabled={loading}>
              {mode === 'login' ? 'Tạo tài khoản' : 'Đã có tài khoản'}
            </Button>
          </Stack>
        )}

        {mode === 'forgot' && (
          <>
            <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} fullWidth autoFocus />
            <Button variant="contained" onClick={requestReset} disabled={loading || !email} startIcon={<EmailIcon />} fullWidth>
              Gửi mã xác minh
            </Button>
          </>
        )}

        {mode === 'reset' && (
          <>
            <TextField label="Email" type="email" value={email} disabled fullWidth />
            <TextField label="Mã xác minh" value={code} onChange={e => setCode(e.target.value)} fullWidth />
            <TextField label="Mật khẩu mới" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} fullWidth />
            <Button variant="contained" onClick={resetPassword} disabled={loading || !code || !newPassword} fullWidth>
              Đặt lại mật khẩu
            </Button>
          </>
        )}

        {mode === 'login' && (
          <Button variant="text" onClick={() => setMode('forgot')} size="small">
            Quên mật khẩu?
          </Button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <Button variant="text" onClick={() => setMode('login')} size="small" startIcon={<ArrowBackIcon />}>
            Quay lại đăng nhập
          </Button>
        )}
      </Stack>
    </Paper>
  )
}