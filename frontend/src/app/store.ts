import { create } from 'zustand'

interface AppState {
  access?: string
  user?: any
  setAccess: (token?: string) => void
  setUser: (u: any) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => {
  const savedAccess = localStorage.getItem('access') || undefined
  const savedUser = JSON.parse(localStorage.getItem('user') || 'null') || undefined

  console.groupCollapsed('🧩 Zustand init store')
  console.log('🔹 access from localStorage =', savedAccess)
  console.log('🔹 user from localStorage =', savedUser)
  console.groupEnd()

  return {
    access: savedAccess,
    user: savedUser,

    setAccess: (token) => {
      console.log('🟢 setAccess called with token =', token)
      if (token) localStorage.setItem('access', token)
      else localStorage.removeItem('access')
      set({ access: token })
    },

    setUser: (u) => {
      console.log('🟢 setUser called with user =', u)
      if (u) localStorage.setItem('user', JSON.stringify(u))
      else localStorage.removeItem('user')
      set({ user: u })
    },

    logout: () => {
      console.log('🔴 logout() triggered')
      localStorage.removeItem('access')
      localStorage.removeItem('user')
      set({ access: undefined, user: undefined })
      location.assign('/login')
    },
  }
})
