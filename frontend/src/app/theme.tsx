import * as React from 'react'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'

type Mode = 'light' | 'dark'
const getInitMode = (): Mode => (localStorage.getItem('mui-mode') as Mode) || 'light'

export function useColorMode(){
  const [mode, setMode] = React.useState<Mode>(getInitMode)
  const toggle = React.useCallback(() => {
    setMode(m => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('mui-mode', next)
      return next
    })
  }, [])
  return { mode, toggle }
}

export default function AppThemeProvider({ children }:{ children: React.ReactNode }){
  const { mode, toggle } = useColorMode()
  const theme = React.useMemo(() => createTheme({
    palette: { mode, primary: { main: '#4f46e5' } },
    shape: { borderRadius: 14 }
  }), [mode])

  ;(window as any).__toggleTheme = toggle
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
