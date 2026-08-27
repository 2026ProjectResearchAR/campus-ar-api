import { afterEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import { TEST_ENV, readJson, type ErrorResponseBody } from './helpers'

// 全エンドポイント共通のエラーレスポンス形式 { error: { code, message } } を検証する。
// 形式が崩れるとクライアント側のエラーハンドリングが一斉に壊れるため、ここで固定する。
describe('共通のエラーレスポンス', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('存在しないエンドポイントは 404 / not_found を返す', async () => {
    const res = await app.request('/api/v1/no-such-endpoint', {}, TEST_ENV)

    expect(res.status).toBe(404)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('not_found')
    expect(body.error.message).toBe('指定されたエンドポイントが存在しません')
  })

  it('クエリパラメータのバリデーション失敗は 400 / bad_request を返す', async () => {
    // upcoming は 'true' | 'false' のみ許容される。
    const res = await app.request('/api/v1/events?upcoming=maybe', {}, TEST_ENV)

    expect(res.status).toBe(400)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('bad_request')
    expect(body.error.message).toBe('リクエストの内容が不正です')
    // defaultHook が Zod の issues を details として付与する。
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  it('リクエストボディのバリデーション失敗は 400 / bad_request を返す', async () => {
    const res = await app.request(
      '/api/v1/sensors/sensor-1/readings',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${TEST_ENV.SENSOR_INGEST_KEY}`,
        },
        body: JSON.stringify({ value: 'not-a-number' }),
      },
      TEST_ENV
    )

    expect(res.status).toBe(400)
    const body = await readJson<ErrorResponseBody>(res)
    expect(body.error.code).toBe('bad_request')
  })
})
