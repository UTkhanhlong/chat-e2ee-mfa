import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'

export default function Layout({ children }:{ children: React.ReactNode }){
  const isDark = (localStorage.getItem('mui-mode') || 'light') === 'dark'
  const [dark, setDark] = React.useState(isDark)
  const toggle = () => { (window as any).__toggleTheme?.(); setDark(d => !d) }

  return (
    <>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ gap: 2 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#4f46e5' }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Chat E2EE + MFA</Typography>
          <Stack direction="row" spacing={1}>
            <Button href="/chat">Chat</Button>
            {/* Đã loại bỏ nút TOTP/2FA khỏi đây */}
          </Stack>
          <Tooltip title="Toggle theme">
            <IconButton onClick={toggle} size="small">
              {dark ? <Brightness7Icon/> : <Brightness4Icon/>}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4, maxWidth: 1100 }}>{children}</Container>
    </>
  )
}