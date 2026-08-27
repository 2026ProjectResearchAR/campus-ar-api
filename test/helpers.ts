import { vi } from 'vitest'

import type { Bindings } from '../src/lib/bindings'

// テスト用のダミー環境変数。app.request() の第3引数として渡す。
// 実際の Supabase / R2 には接続せず、outbound fetch は stubFetch() で差し替える。
export const TEST_ENV: Bindings = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SENSOR_INGEST_KEY: 'test-ingest-key',
  R2_PUBLIC_BASE_URL: 'https://assets.example.com',
}

// stubFetch() が記録する、アプリから Supabase へ送られたリクエスト。
export type CapturedRequest = {
  method: string
  url: URL
  headers: Headers
  body: unknown
}

/**
 * グローバル fetch を差し替え、Supabase（PostgREST / GoTrue）への通信をモックする。
 *
 * supabase-js は `(...args) => fetch(...args)` の形で毎回グローバルを参照するため、
 * vi.stubGlobal による差し替えがそのまま効く。
 * 戻り値の配列には送信されたリクエストが順に積まれるので、
 * 生成されたクエリ文字列や Authorization ヘッダの検証に使える。
 */
export function stubFetch(
  handler: (req: CapturedRequest) => Response | Promise<Response>
): CapturedRequest[] {
  const calls: CapturedRequest[] = []

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    const rawBody = typeof init?.body === 'string' ? init.body : undefined

    const req: CapturedRequest = {
      method,
      url: new URL(rawUrl),
      headers,
      body: rawBody === undefined ? undefined : JSON.parse(rawBody),
    }
    calls.push(req)

    return handler(req)
  })

  return calls
}

// PostgREST / GoTrue のレスポンスを模したもの。
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// PostgREST のエラーレスポンス（postgrest-js はこの形を error として解釈する）。
export function postgrestError(message: string, status = 500): Response {
  return jsonResponse({ message, details: '', hint: '', code: 'TEST' }, status)
}

// レスポンスボディを型付きで取り出すヘルパー（res.json() は unknown を返すため）。
export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

// 共通エラーレスポンス { error: { code, message, details? } } の型。
export type ErrorResponseBody = {
  error: { code: string; message: string; details?: unknown }
}
