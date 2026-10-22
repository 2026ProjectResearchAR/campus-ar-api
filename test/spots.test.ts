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

type SpotsBody = {
  data: {
    id: string
    name: string
    description: string | null
    building: { id: string; name: string }
    ar_assets: { type: string; url: string }[]
  }[]
}

describe('GET /api/v1/spots/{marker_id}', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['@marker_fuzimotolab', '%40marker_fuzimotolab', 'marker@fuzimotolab'])(
    '@ を含むマーカーID %s はDBを検索せずARクライアントへリダイレクトする',
    async (markerId) => {
      const calls = stubFetch(() => jsonResponse([]))

      const res = await app.request(`/api/v1/spots/${markerId}?source=qr`, {}, TEST_ENV)

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('https://ar-cloud.chikai400up.workers.dev/')
      expect(await res.text()).toBe('')
      expect(calls).toHaveLength(0)
    }
  )

  it('クエリだけに @ が含まれる場合は通常のスポット検索を行う', async () => {
    const calls = stubFetch(() => jsonResponse([]))

    const res = await app.request('/api/v1/spots/marker-001?source=@qr', {}, TEST_ENV)

    expect(res.status).toBe(200)
    expect(res.headers.get('Location')).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0].url.searchParams.get('marker_id')).toBe('eq.marker-001')
  })

  it('OpenAPIにリダイレクト条件と302の転送先ヘッダーが記載される', async () => {
    const res = await app.request('/openapi.json', {}, TEST_ENV)
    const body = await readJson<{
      paths: Record<string, {
        get: {
          description: string
          responses: Record<string, {
            headers?: Record<string, { schema: { type: string; example: string } }>
          }>
        }
      }>
    }>(res)
    const route = body.paths['/api/v1/spots/{marker_id}'].get

    expect(res.status).toBe(200)
    expect(route.description).toContain('@')
    expect(route.responses['302'].headers?.Location.schema).toMatchObject({
      type: 'string',
      example: 'https://ar-cloud.chikai400up.workers.dev/',
    })
    expect(route.responses['200']).toBeDefined()
  })

  it('スポット詳細と、公開URLに変換したARアセットを返す', async () => {
    const calls = stubFetch(() =>
      jsonResponse([
        {
          id: 's1',
          name: '正門',
          description: 'キャンパスの入口',
          building: { id: 'b1', name: '1号館' },
          ar_assets: [{ type: 'model', storage_path: '/models/gate.glb' }],
        },
      ])
    )

    const res = await app.request('/api/v1/spots/marker-001', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<SpotsBody>(res)
    expect(body.data).toEqual([
      {
        id: 's1',
        name: '正門',
        description: 'キャンパスの入口',
        building: { id: 'b1', name: '1号館' },
        // storage_path の先頭スラッシュは重複しないように吸収される。
        ar_assets: [{ type: 'model', url: 'https://assets.example.com/models/gate.glb' }],
      },
    ])

    expect(calls[0].url.pathname).toBe('/rest/v1/spots')
    expect(calls[0].url.searchParams.get('marker_id')).toBe('eq.marker-001')
  })

  it('建物が配列で埋め込まれてきても単一オブジェクトに正規化する', async () => {
    stubFetch(() =>
      jsonResponse([
        {
          id: 's1',
          name: '正門',
          description: null,
          building: [{ id: 'b1', name: '1号館' }],
          ar_assets: null,
        },
      ])
    )

    const res = await app.request('/api/v1/spots/marker-001', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<SpotsBody>(res)
    expect(body.data[0].building).toEqual({ id: 'b1', name: '1号館' })
    expect(body.data[0].ar_assets).toEqual([])
  })

  it('該当するマーカーが無ければ空配列を返す', async () => {
    stubFetch(() => jsonResponse([]))

    const res = await app.request('/api/v1/spots/unknown-marker', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<SpotsBody>(res)
    expect(body.data).toEqual([])
  })

  it('Supabase がエラーを返したら 500 を返す', async () => {
    stubFetch(() => postgrestError('boom'))

    const res = await app.request('/api/v1/spots/marker-001', {}, TEST_ENV)

    expect(res.status).toBe(500)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('internal_server_error')
    expect(body.error.message).toBe('スポット情報の取得に失敗しました')
  })
})
