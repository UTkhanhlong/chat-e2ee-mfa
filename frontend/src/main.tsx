import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import AppThemeProvider from './app/theme'

// (Nếu trước đó bạn import './styles/tailwind.css', có thể giữ nguyên hoặc bỏ – không ảnh hưởng MUI)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppThemeProvider>
    <RouterProvider router={router}/>
  </AppThemeProvider>
)
