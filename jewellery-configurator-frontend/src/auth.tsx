import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export type User = { id: number; name: string; email: string; role: 'customer' | 'admin' }
const KEY = 'maison-auth-token'
const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '')
type AuthState = { user: User | null; ready: boolean; login: (email: string, password: string, role: User['role']) => Promise<void>; logout: () => Promise<void> }
const Context = createContext<AuthState | null>(null)
export const token = () => sessionStorage.getItem(KEY)
export function clearToken() { sessionStorage.removeItem(KEY); window.dispatchEvent(new Event('auth-changed')) }
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(init?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
  return body.data as T
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false)
  const hydrate = useCallback(async () => {
    if (!token()) { setUser(null); setReady(true); return }
    try { setUser((await call<{ user: User }>('/auth/me')).user) } catch { clearToken(); setUser(null) } finally { setReady(true) }
  }, [])
  useEffect(() => { void hydrate(); window.addEventListener('auth-changed', hydrate); return () => window.removeEventListener('auth-changed', hydrate) }, [hydrate])
  const login = useCallback(async (email: string, password: string, role: User['role']) => {
    const session = await call<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (session.user.role !== role) { await fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }).catch(() => {}); throw new Error(role === 'admin' ? 'This account does not have administrator access.' : 'Please use the administrator portal for this account.') }
    sessionStorage.setItem(KEY, session.token)
    if (role === 'customer') {
      const id = localStorage.getItem('maison-session-id')
      try { if (id) await call('/auth/session/claim', { method: 'POST', headers: { 'x-session-id': id } }) }
      catch (error) { clearToken(); throw error }
    }
    setUser(session.user); setReady(true); window.dispatchEvent(new Event('auth-changed'))
  }, [])
  const logout = useCallback(async () => { try { if (token()) await call('/auth/logout', { method: 'POST' }) } finally { clearToken(); setUser(null) } }, [])
  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
export function RequireRole({ role, children }: { role: User['role']; children: ReactNode }) {
  const { user, ready } = useAuth(); const location = useLocation()
  if (!ready) return <div className="loading-state">Checking your account…</div>
  if (user?.role !== role) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}
