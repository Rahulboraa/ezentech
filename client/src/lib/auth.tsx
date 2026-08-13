import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (userId: string, pin: string) => Promise<AuthUser>
  logout: (message?: string) => void
  logoutMessage: string
}

const AuthContext = createContext<AuthState>(null as never)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(!!getToken())
  const [logoutMessage, setLogoutMessage] = useState('')
  const queryClient = useQueryClient()
  const userRef = useRef<AuthUser | null>(null)
  userRef.current = user

  const logout = useCallback(
    (message = '') => {
      setToken(null)
      setUser(null)
      setLogoutMessage(message)
      queryClient.clear()
    },
    [queryClient],
  )

  const login = useCallback(async (userId: string, pin: string) => {
    const res = await api<{ token: string; user: AuthUser }>('/auth/login', { body: { userId, pin } })
    setToken(res.token)
    setUser(res.user)
    setLogoutMessage('')
    return res.user
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) logout('Session expired. Sign in again.')
    })
  }, [logout])

  useEffect(() => {
    if (!getToken()) return
    api<{ user: AuthUser }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout, logoutMessage }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
