import { describe, expect, it } from 'vitest'

import app from '../src/index'
import { TEST_ENV, readJson } from './helpers'

describe('GET /api/health', () => {
  it('200 とヘルス情報を返す', async () => {
    const res = await app.request('/api/health', {}, TEST_ENV)

    expect(res.status).toBe(200)
    const body = await readJson<{ status: string; timestamp: string }>(res)
    expect(body.status).toBe('ok')
    // timestamp は ISO 8601 でパースできること
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false)
  })
})
