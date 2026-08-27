import { afterEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import {
  TEST_ENV,
  jsonResponse,
  postgrestError,
  readJson,
  stubFetch,
  type ErrorResponseBody,
} from './helpers'

type BuildingsBody = {
  data: { id: string; name: string; marker_count: number }[]
}

describe('GET /api/v1/buildings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('スポット数を marker_count に集計して返す', async () => {
    const calls = stubFetch(() =>
      jsonResponse([
        { id: 'b1', name: '1号館', spots: [{ count: 3 }] },
        // スポットが未登録の建物は spots が空配列で返る。
        { id: 'b2', name: '2号館', spots: [] },
      ])
    )

    const res = await app.request('/api/v1/buildings', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<BuildingsBody>(res)
    expect(body.data).toEqual([
      { id: 'b1', name: '1号館', marker_count: 3 },
      { id: 'b2', name: '2号館', marker_count: 0 },
    ])

    // 読み取りは anon key のクライアント（getSupabase）で行われる。
    expect(calls).toHaveLength(1)
    expect(calls[0].url.pathname).toBe('/rest/v1/buildings')
    expect(calls[0].url.searchParams.get('select')).toBe('id,name,spots(count)')
    expect(calls[0].url.searchParams.get('order')).toBe('name.asc')
    expect(calls[0].headers.get('apikey')).toBe(TEST_ENV.SUPABASE_ANON_KEY)
  })

  it('Supabase がエラーを返したら 500 / internal_server_error を返す', async () => {
    stubFetch(() => postgrestError('relation does not exist'))

    const res = await app.request('/api/v1/buildings', {}, TEST_ENV)

    expect(res.status).toBe(500)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('internal_server_error')
    expect(body.error.message).toBe('建物一覧の取得に失敗しました')
    // Supabase 側の生のエラー文言はクライアントへ漏らさない。
    expect(JSON.stringify(body)).not.toContain('relation does not exist')
  })
})
