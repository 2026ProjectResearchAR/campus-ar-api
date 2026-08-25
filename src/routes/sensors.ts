import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import type { Bindings } from '../lib/bindings'
import { getSupabaseAdmin } from '../lib/supabase'

const app = new OpenAPIHono<{ Bindings: Bindings }>()

// 送信された計測値1件のリクエストスキーマ。
// recorded_at はデバイス側の計測時刻（省略時はサーバ受信時刻を採用）。
const ReadingInputSchema = z.object({
  value: z.number(),
  recorded_at: z.iso.datetime().optional(),
})

// 保存済み計測値のレスポンススキーマ。
const ReadingSchema = z.object({
  id: z.string(),
  sensor_id: z.string(),
  value: z.number(),
  recorded_at: z.string(),
  created_at: z.string(),
})

const route = createRoute({
  method: 'post',
  path: '/api/v1/sensors/{sensor_id}/readings',
  summary: 'センサ計測値の登録',
  description:
    '学内に設置したIoTデバイスから送信されるセンサ計測値を保存する。デバイス認証は Authorization: Bearer <SENSOR_INGEST_KEY> で行う。',
  tags: ['Sensors'],
  request: {
    params: z.object({
      sensor_id: z.string().openapi({
        param: { name: 'sensor_id', in: 'path' },
        example: 'uuid',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: ReadingInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({ data: ReadingSchema }),
        },
      },
      description: 'Reading recorded',
    },
    401: { description: 'Unauthorized' },
    404: { description: 'Sensor not found' },
  },
})

app.openapi(route, async (c) => {
  // デバイス認証: 事前共有キーを Bearer トークンとして検証する。
  const auth = c.req.header('Authorization')
  const expected = `Bearer ${c.env.SENSOR_INGEST_KEY}`
  if (!c.env.SENSOR_INGEST_KEY || auth !== expected) {
    throw new HTTPException(401, { message: '認証に失敗しました' })
  }

  const { sensor_id } = c.req.valid('param')
  const { value, recorded_at } = c.req.valid('json')
  const supabase = getSupabaseAdmin(c.env)

  // 不正な sensor_id での insert（外部キー違反）を明示的な 404 にするため事前に存在確認する。
  const { data: sensor, error: sensorError } = await supabase
    .from('sensors')
    .select('id')
    .eq('id', sensor_id)
    .maybeSingle()

  if (sensorError) {
    throw new HTTPException(500, { message: 'センサの確認に失敗しました' })
  }
  if (!sensor) {
    throw new HTTPException(404, { message: '指定されたセンサが見つかりません' })
  }

  const { data, error } = await supabase
    .from('sensor_readings')
    .insert({
      sensor_id,
      value,
      recorded_at: recorded_at ?? new Date().toISOString(),
    })
    .select('id, sensor_id, value, recorded_at, created_at')
    .single()

  if (error || !data) {
    throw new HTTPException(500, { message: 'センサ計測値の保存に失敗しました' })
  }

  return c.json({ data }, 201)
})

export default app
