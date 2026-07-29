const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001').trim()

export const apiBaseUrl = rawApiUrl.replace(/\/+$/, '')
export const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3003'

export type ApiResponse = {
  message?: unknown
  error?: unknown
  data?: Record<string, unknown>
}

/**
 * Resolves a versioned API endpoint. Accepts a base that already ends in
 * `/api/v1` (production reverse-proxy style) or a bare origin (local dev).
 */
export function buildEndpoint(endpoint: string) {
  if (!apiBaseUrl) return ''
  const hasVersionedApi = /\/api\/v\d+$/i.test(apiBaseUrl)
  return `${apiBaseUrl}${hasVersionedApi ? '' : '/api/v1'}${endpoint}`
}

export function readResponseMessage(body: ApiResponse) {
  if (typeof body.message === 'string') return body.message
  if (typeof body.error === 'string') return body.error
  if (typeof body.data?.message === 'string') return body.data.message
  return ''
}

export type PostResult =
  | { ok: true; data: Record<string, unknown>; message: string }
  | { ok: false; message: string }

/** POSTs JSON and normalises both the success envelope and the error message. */
export async function postJson(endpoint: string, payload: Record<string, unknown>): Promise<PostResult> {
  const url = buildEndpoint(endpoint)
  if (!url) {
    return { ok: false, message: 'API URL is not configured for this deployment.' }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const body = (await response.json().catch(() => ({}))) as ApiResponse
    const message = readResponseMessage(body)

    if (!response.ok) {
      return { ok: false, message: message || `Request failed (${response.status}).` }
    }

    return { ok: true, data: body.data || {}, message }
  } catch {
    return {
      ok: false,
      message: 'Could not reach the QHR service. Check your connection and try again.',
    }
  }
}
