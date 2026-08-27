import { afterEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import {
  TEST_ENV,
  jsonResponse,
  readJson,
  stubFetch,
  type CapturedRequest,
  type ErrorResponseBody,
} from './helpers'

const USER_ID = '22222222-2222-4222-8222-222222222222'

// Supabase Auth の GET /auth/v1/user をモックする。
// valid=false のときは GoTrue が 401 を返す状況を再現する。
function stubAuth(options: { valid: boolean }) {
  return stubFetch((req: CapturedRequest) => {
    if (req.url.pathname === '/auth/v1/user') {
      if (!options.valid) {
        return jsonResponse({ message: 'invalid claim: missing sub claim' }, 401)
      }
      return jsonResponse({
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'student@example.ac.jp',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00+00:00',
      })
    }
    throw new Error(`予期しないリクエスト: ${req.url.toString()}`)
  })
}

describe('users/me/* の認証', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Authorization ヘッダが無ければ 401 を返す', async () => {
    const res = await app.request('/api/v1/users/me/visits', {}, TEST_ENV)

    expect(res.status).toBe(401)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('unauthorized')
    expect(body.error.message).toBe('認証トークンが必要です')
  })

  it('Bearer スキーム以外は 401 を返す', async () => {
    const res = await app.request(
      '/api/v1/users/me/visits',
      { headers: { Authorization: 'Basic abc' } },
      TEST_ENV
    )

    expect(res.status).toBe(401)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.message).toBe('認証トークンが必要です')
  })

  it('Supabase が検証に失敗したら 401 を返す', async () => {
    stubAuth({ valid: false })

    const res = await app.request(
      '/api/v1/users/me/visits',
      { headers: { Authorization: 'Bearer invalid-jwt' } },
      TEST_ENV
    )

    expect(res.status).toBe(401)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.message).toBe('認証に失敗しました')
  })
})

describe('GET /api/v1/users/me/visits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('認証済みなら訪問履歴を返す', async () => {
    const calls = stubAuth({ valid: true })

    const res = await app.request(
      '/api/v1/users/me/visits',
      { headers: { Authorization: 'Bearer valid-jwt' } },
      TEST_ENV
    )

    expect(res.status).toBe(200)
    // TODO: user_visits の DB 接続後は、userId で絞り込まれた実データを検証する。
    const body = await readJson<{ data: { id: string; spot_id: string; visited_at: string }[] }>(res)
    expect(Array.isArray(body.data)).toBe(true)

    // JWT はヘッダではなく getUser(token) 経由で Supabase Auth に渡される。
    expect(calls[0].url.pathname).toBe('/auth/v1/user')
    expect(calls[0].headers.get('Authorization')).toBe('Bearer valid-jwt')
  })
})

describe('POST /api/v1/users/me/visits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('認証済みなら訪問記録を作成して 201 を返す', async () => {
    stubAuth({ valid: true })

    const res = await app.request(
      '/api/v1/users/me/visits',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer valid-jwt',
        },
        body: JSON.stringify({ spot_id: 'spot-1' }),
      },
      TEST_ENV
    )

    expect(res.status).toBe(201)
    // TODO: DB 接続後は挿入された行（userId 紐付け）を検証する。
    const body = await readJson<{ data: { spot_id: string } }>(res)
    expect(body.data.spot_id).toBe('spot-1')
  })

  it('spot_id が無ければ 400 を返す', async () => {
    stubAuth({ valid: true })

    const res = await app.request(
      '/api/v1/users/me/visits',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer valid-jwt',
        },
        body: JSON.stringify({}),
      },
      TEST_ENV
    )

    expect(res.status).toBe(400)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('bad_request')
  })
})
