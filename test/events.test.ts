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

type EventsBody = {
  data: {
    id: string
    title: string
    description: string | null
    start_time: string
    end_time: string
  }[]
}

const SAMPLE_EVENT = {
  id: 'e1',
  title: 'オープンキャンパス',
  description: null,
  start_time: '2026-09-01T01:00:00+00:00',
  end_time: '2026-09-01T08:00:00+00:00',
}

describe('GET /api/v1/events', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('開始時刻の昇順でイベント一覧を返す', async () => {
    const calls = stubFetch(() => jsonResponse([SAMPLE_EVENT]))

    const res = await app.request('/api/v1/events', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<EventsBody>(res)
    expect(body.data).toEqual([SAMPLE_EVENT])

    expect(calls[0].url.pathname).toBe('/rest/v1/events')
    expect(calls[0].url.searchParams.get('order')).toBe('start_time.asc')
    // 絞り込み指定なしのときは end_time フィルタを付けない。
    expect(calls[0].url.searchParams.has('end_time')).toBe(false)
  })

  it('upcoming=true のとき end_time で現在時刻以降に絞り込む', async () => {
    const calls = stubFetch(() => jsonResponse([SAMPLE_EVENT]))

    const res = await app.request('/api/v1/events?upcoming=true', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const filter = calls[0].url.searchParams.get('end_time')
    expect(filter).toMatch(/^gte\./)
    expect(Number.isNaN(Date.parse(filter!.slice('gte.'.length)))).toBe(false)
  })

  it('upcoming=false のときは絞り込まない', async () => {
    const calls = stubFetch(() => jsonResponse([]))

    const res = await app.request('/api/v1/events?upcoming=false', {}, TEST_ENV)

    expect(res.status).toBe(200)
    expect(calls[0].url.searchParams.has('end_time')).toBe(false)
  })

  it('Supabase がエラーを返したら 500 を返す', async () => {
    stubFetch(() => postgrestError('boom'))

    const res = await app.request('/api/v1/events', {}, TEST_ENV)

    expect(res.status).toBe(500)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('internal_server_error')
    expect(body.error.message).toBe('イベント一覧の取得に失敗しました')
  })
})
