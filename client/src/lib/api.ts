const TOKEN_KEY = 'ez_token'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

interface Options {
  method?: string
  body?: unknown
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  const fresh = res.headers.get('x-refresh-token')
  if (fresh) setToken(fresh)

  const data = await res.json().catch(() => null)
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    onUnauthorized()
    throw new ApiError(401, 'Session expired', data)
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? 'Request failed', data)
  return data as T
}

export async function apiDownload(path: string, filename: string) {
  const token = getToken()
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, (data as { error?: string })?.error ?? 'Download failed', data)
  }
  const fresh = res.headers.get('x-refresh-token')
  if (fresh) setToken(fresh)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
