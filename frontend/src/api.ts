const JWT_KEY = 'agri_jwt'
const REFRESH_KEY = 'agri_refresh'

export function getStoredAccess(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(JWT_KEY) : null
}

export function getStoredRefresh(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null
}

export function setTokens(access: string, refresh?: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(JWT_KEY, access)
  if (refresh != null) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(JWT_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refreshAccess(): Promise<string | null> {
  const refresh = getStoredRefresh()
  if (!refresh) return null
  const base = typeof window !== 'undefined' ? (window as Window & { __API_BASE__?: string }).__API_BASE__ ?? '' : ''
  const res = await fetch(`${base}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  const access = data.access
  if (access) {
    setTokens(access, data.refresh ?? refresh)
    return access
  }
  return null
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  let token = getStoredAccess()
  const headers: HeadersInit = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  let res = await fetch(input, { ...init, headers })

  if (res.status === 401) {
    const newAccess = await refreshAccess()
    if (newAccess) {
      const newHeaders: HeadersInit = {
        ...(init.headers || {}),
        Authorization: `Bearer ${newAccess}`,
      }
      res = await fetch(input, { ...init, headers: newHeaders })
    }
  }
  return res
}
