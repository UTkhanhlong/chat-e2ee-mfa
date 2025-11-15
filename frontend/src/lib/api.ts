// lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

const PUBLIC_ENDPOINTS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/public-key/',
  '/api/auth/2fa/verify-email',
  '/api/auth/request-reset',
  '/api/auth/reset-password',
]

export async function api(path: string, options: RequestInit = {}, token?: string) {
  const isPublicEndpoint = PUBLIC_ENDPOINTS.some(ep => path.startsWith(ep))
  
  let access: string | null = token

  if (!isPublicEndpoint && !access) {
    access = localStorage.getItem('access') // ← CHỈ DÙNG LOCALSTORAGE
  }

  console.groupCollapsed('API DEBUG', path)
  console.log('Public?', isPublicEndpoint)
  console.log('Token param:', token)
  console.log('Final token:', access || '(none)')
  console.groupEnd()

  const headers = new Headers(options.headers || {})
  const isFormData = options.body instanceof FormData

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (access) {
    headers.set('Authorization', `Bearer ${access}`)
  }

  console.log('Sending token:', access)

  const res = await fetch(API_BASE + path, { ...options, headers })

  if (!res.ok) {
    const text = await res.text()
    console.error(`HTTP ${res.status}:`, text)
    throw new Error(`HTTP ${res.status}:: ${text}`)
  }

  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return res.json()
  }
  return res.text()
}