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

describe('POST /api/v1/sensors/readings', () => {
  it('旧センサーID付きURLは404を返しDBへアクセスしない', async () => {
    const calls = stubFetch(() => jsonResponse({}))
    const res = await app.request('/api/v1/sensors/sensor-1/readings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 850 }),
    }, TEST_ENV)
    expect(res.status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('OpenAPIにはbodyでIDを受け取る新URLのみ公開する', async () => {
    const res = await app.request('/openapi.json', {}, TEST_ENV)
    const spec = await readJson<{ paths: Record<string, unknown> }>(res)
    expect(spec.paths).toHaveProperty('/api/v1/sensors/readings')
    expect(spec.paths).not.toHaveProperty('/api/v1/sensors/{sensor_id}/readings')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function postEnvironmentReading(body: unknown) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    return app.request(
      '/api/v1/sensors/readings',
      { method: 'POST', headers, body: JSON.stringify(body) },
      TEST_ENV
    )
  }

  it.each(['crowded', 'moderate', 'vacant'])('状態 %s の環境データを登録して 201 を返す', async (status) => {
    const calls = stubFetch((req) => {
      if (req.url.pathname !== '/rest/v1/environment_readings') {
        throw new Error(`予期しないリクエスト: ${req.url.toString()}`)
      }

      const inserted = req.body as {
        id: string
        location_id: string
        co2_ppm: number
        occupancy: number
        status: string
        recorded_at: string
      }
      return jsonResponse({
        ...inserted,
        created_at: '2026-10-22T00:00:00.000Z',
      })
    })

    const res = await postEnvironmentReading(
      { location_id: 'building_1', co2_ppm: 850, occupancy: 7, status }
    )

    expect(res.status).toBe(201)
    const body = await readJson<{
      data: { location_id: string; co2_ppm: number; occupancy: number; status: string }
    }>(res)
    expect(body.data).toMatchObject({
      location_id: 'building_1',
      co2_ppm: 850,
      occupancy: 7,
      status,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toMatchObject({
      location_id: 'building_1',
      co2_ppm: 850,
      occupancy: 7,
      status,
    })
    const { id } = calls[0].body as { id: string }
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const { recorded_at } = calls[0].body as { recorded_at: string }
    expect(Number.isNaN(Date.parse(recorded_at))).toBe(false)
    expect(calls[0].headers.get('apikey')).toBe(TEST_ENV.SUPABASE_SERVICE_ROLE_KEY)
  })

  it('DB保存失敗時は内部エラーを漏らさず500を返す', async () => {
    stubFetch(() => postgrestError('private database details', 400))
    const res = await postEnvironmentReading(
      { location_id: 'building_1', co2_ppm: 850, occupancy: 7, status: 'moderate' }
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { code: 'internal_server_error', message: '環境・混雑センサ計測値の保存に失敗しました' },
    })
  })

  it.each([
    [{}],
    [{ location_id: 'building_1', co2_ppm: 850, occupancy: 2147483648, status: 'moderate' }],
    [{ location_id: '', co2_ppm: 850, occupancy: 7, status: 'moderate' }],
    [{ location_id: 'building_1', co2_ppm: -1, occupancy: 7, status: 'moderate' }],
    [{ location_id: 'building_1', co2_ppm: 850, occupancy: -1, status: 'moderate' }],
    [{ location_id: 'building_1', co2_ppm: 850, occupancy: 1.5, status: 'moderate' }],
    [{ location_id: 'building_1', co2_ppm: 850, occupancy: 7, status: 'busy' }],
    [{ location_id: 'building_1', co2_ppm: 850, occupancy: 7, status: 'vacant ' }],
  ])('不正なリクエストは 400 を返す: %j', async (invalidBody) => {
    const res = await postEnvironmentReading(invalidBody)

    expect(res.status).toBe(400)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('bad_request')
  })
})
