'use client'

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: { page?: number; pageSize?: number; total?: number; [k: string]: unknown }
  error?: { code: string; message: string; issues?: unknown }
}

export class ApiError extends Error {
  code: string
  status: number
  issues?: unknown
  constructor(message: string, code: string, status: number, issues?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.issues = issues
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('Network error', 'NETWORK', res.status)
  }
  if (!res.ok || !body.success) {
    throw new ApiError(body.error?.message || 'Request failed', body.error?.code || 'UNKNOWN', res.status, body.error?.issues)
  }
  return body
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await api<T>(path)
  return res.data
}

/** Fetch with pagination meta. */
export async function apiQuery<T = unknown>(path: string): Promise<{ data: T; meta: { page?: number; pageSize?: number; total?: number } }> {
  const res = await api<T>(path)
  return { data: res.data, meta: res.meta ?? {} }
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined })
  return res.data
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined })
  return res.data
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await api<T>(path, { method: 'DELETE' })
  return res.data
}

export async function apiUpload<T = { url: string; fileName: string; fileType: string; fileSize: number }>(file: File): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await api<T>('/api/upload', { method: 'POST', body: fd })
  return res.data
}

/** Build a query string from params, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** Download data as a CSV file client-side. */
export function downloadCsv(filename: string, columns: { key: string; header: string }[], rows: Record<string, unknown>[]) {
  const lines = [columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => {
      let v = row[c.key]
      if (v == null) v = ''
      if (typeof v === 'boolean') v = v ? 'Yes' : 'No'
      if (v instanceof Date) v = v.toISOString().slice(0, 10)
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) v = v.slice(0, 10)
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(','))
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
