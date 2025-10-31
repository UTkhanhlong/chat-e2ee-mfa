import { useAppStore } from '../app/store'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export async function api(path: string, options: RequestInit = {}, token?: string) {
  // 🔹 Lấy token từ store hoặc localStorage
  const storeAccess = useAppStore.getState().access
  const localAccess = localStorage.getItem('access')
  const access = token || storeAccess || localAccess

  // ⚙️ Debug chi tiết nguồn token
  console.groupCollapsed('🧩 [API DEBUG]', path)
  console.log('🔹 Token truyền vào hàm (tham số):', token)
  console.log('🔹 Token lấy từ Zustand store:', storeAccess)
  console.log('🔹 Token lấy từ localStorage:', localAccess)
  console.log('✅ Token cuối cùng sẽ dùng:', access)
  console.groupEnd()

  // 🧩 Thiết lập header
  const headers = new Headers(options.headers || {})
  const isFormData = options.body instanceof FormData

  // ❗ Nếu là FormData => KHÔNG đặt Content-Type (tránh lỗi boundary)
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // 🧠 Gắn token vào Authorization
  if (access) headers.set('Authorization', `Bearer ${access}`)

  // 🪵 Log token gửi đi
  console.log('🔑 Gửi token:', access)

  // 🧩 Gửi request
  const res = await fetch(API_BASE + path, { ...options, headers })

  if (!res.ok) {
    const text = await res.text()
    console.error(`❌ HTTP ${res.status}:`, text)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  // 🧩 Tự động parse JSON (nếu có)
  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return res.json()
  }
  return res.text()
}
