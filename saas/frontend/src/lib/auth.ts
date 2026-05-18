import { readJson, writeJson } from './storage'

export type AuthType = 'platform' | 'tenant'

export type PlatformSession = {
  type: 'platform'
  account: string
  token: string
}

export type TenantSession = {
  type: 'tenant'
  tenantId: string
  tenantName: string
  account: string
  displayName: string
  token: string
}

export type Session = PlatformSession | TenantSession

const SESSION_KEY = 'mvp_session_v1'

export function getSession(): Session | null {
  const s = readJson<Session | null>(SESSION_KEY, null)
  if (!s) return null
  if (!(s as { token?: string }).token) return null
  return s
}

export function setSession(session: Session) {
  writeJson(SESSION_KEY, session)
}

export function clearSession() {
  writeJson(SESSION_KEY, null)
}

export function getToken() {
  const session = getSession()
  return session?.token ?? null
}
