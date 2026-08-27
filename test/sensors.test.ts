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

const SENSOR_ID = '11111111-1111-4111-8111-111111111111'

function post(body: unknown, authorization?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authorization !== undefined) {
    headers.Authorization = authorization
  }
  return app.request(
    `/api/v1/sensors/${SENSOR_ID}/readings`,
    { method: 'POST', headers, body: JSON.stringify(body) },
    TEST_ENV
  )
}

// sensors の存在確認（GET）と計測値の登録（POST）を URL で振り分けるモック。
function stubSupabase(options: { sensorExists: boolean }) {
  return stubFetch((req: CapturedRequest) => {
    if (req.url.pathname === '/rest/v1/sensors') {
      // maybeSingle() は配列で受け取り、クライアント側で単一化される。
      return jsonResponse(options.sensorExists ? [{ id: SENSOR_ID }] : [])
    }
    if (req.url.pathname === '/rest/v1/sensor_readings') {
      const inserted = req.body as { sensor_id: string; value: number; recorded_at: string }
      // single() はオブジェクトを期待する。
      return jsonResponse({
        id: 'reading-1',
        sensor_id: inserted.sensor_id,
        value: inserted.value,
        recorded_at: inserted.recorded_at,
        created_at: '2026-08-27T00:00:00+00:00',
      })
    }
    throw new Error(`予期しないリクエスト: ${req.url.toString()}`)
  })
}

describe('POST /api/v1/sensors/{sensor_id}/readings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Authorization ヘッダが無ければ 401 を返す', async () => {
    const res = await post({ value: 21.5 })

    expect(res.status).toBe(401)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('unauthorized')
  })

  it('事前共有キーが一致しなければ 401 を返す', async () => {
    const res = await post({ value: 21.5 }, 'Bearer wrong-key')

    expect(res.status).toBe(401)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('unauthorized')
  })

  it('存在しないセンサなら 404 を返す（外部キー違反にしない）', async () => {
    const calls = stubSupabase({ sensorExists: false })

    const res = await post({ value: 21.5 }, `Bearer ${TEST_ENV.SENSOR_INGEST_KEY}`)

    expect(res.status).toBe(404)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('not_found')
    expect(body.error.message).toBe('指定されたセンサが見つかりません')
    // 存在確認だけで終わり、insert は実行されない。
    expect(calls.map((c) => c.url.pathname)).toEqual(['/rest/v1/sensors'])
  })

  it('計測値を登録して 201 を返す', async () => {
    const calls = stubSupabase({ sensorExists: true })

    const res = await post(
      { value: 21.5, recorded_at: '2026-08-27T12:34:56.000Z' },
      `Bearer ${TEST_ENV.SENSOR_INGEST_KEY}`
    )

    expect(res.status).toBe(201)
    const body = await readJson<{ data: { sensor_id: string; value: number } }>(res)
    expect(body.data.sensor_id).toBe(SENSOR_ID)
    expect(body.data.value).toBe(21.5)

    const insert = calls.find((c) => c.url.pathname === '/rest/v1/sensor_readings')!
    expect(insert.method).toBe('POST')
    expect(insert.body).toEqual({
      sensor_id: SENSOR_ID,
      value: 21.5,
      recorded_at: '2026-08-27T12:34:56.000Z',
    })
    // 書き込みは RLS をバイパスする service role key で行う。
    expect(insert.headers.get('apikey')).toBe(TEST_ENV.SUPABASE_SERVICE_ROLE_KEY)
  })

  it('recorded_at 省略時はサーバ受信時刻を採用する', async () => {
    const calls = stubSupabase({ sensorExists: true })

    const res = await post({ value: 30 }, `Bearer ${TEST_ENV.SENSOR_INGEST_KEY}`)

    expect(res.status).toBe(201)
    const insert = calls.find((c) => c.url.pathname === '/rest/v1/sensor_readings')!
    const { recorded_at } = insert.body as { recorded_at: string }
    expect(Number.isNaN(Date.parse(recorded_at))).toBe(false)
  })
})
