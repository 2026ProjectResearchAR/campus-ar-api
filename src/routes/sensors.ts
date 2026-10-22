import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { createApp } from '../lib/app'
import { errorResponse } from '../lib/errors'
import { getSupabaseAdmin } from '../lib/supabase'

const app = createApp()

async function isValidIngestAuthorization(
  authorization: string | undefined,
  ingestKey: string
): Promise<boolean> {
  if (!authorization || !ingestKey) {
    return false
  }

  const encoder = new TextEncoder()
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(authorization)),
    crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${ingestKey}`)),
  ])

  return crypto.subtle.timingSafeEqual(actualHash, expectedHash)
}

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

const EnvironmentReadingInputSchema = z.object({
  location_id: z.string().trim().min(1),
  co2_ppm: z.number().nonnegative(),
  occupancy: z.number().int().nonnegative().max(2147483647),
  status: z.enum(['crowded', 'moderate', 'vacant']),
})

const EnvironmentReadingSchema = z.object({
  id: z.string(),
  location_id: z.string(),
  co2_ppm: z.number(),
  occupancy: z.number().int(),
  status: z.enum(['crowded', 'moderate', 'vacant']),
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
    400: errorResponse('リクエストの内容が不正です'),
    401: errorResponse('認証に失敗しました'),
    404: errorResponse('指定されたセンサが見つかりません'),
    500: errorResponse('センサ計測値の保存に失敗しました'),
  },
})

const environmentReadingRoute = createRoute({
  method: 'post',
  path: '/api/v1/sensors/readings',
  summary: '環境・混雑センサ計測値の登録',
  description:
    'ハードウェアから1分ごとに送信される場所別のCO2濃度、周辺人数、混雑状態を保存する。計測時刻にはサーバー受信時刻を採用する。認証は不要。',
  tags: ['Sensors'],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: EnvironmentReadingInputSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({ data: EnvironmentReadingSchema }),
        },
      },
      description: '環境・混雑センサ計測値を登録しました',
    },
    400: errorResponse('リクエストの内容が不正です'),
    500: errorResponse('環境・混雑センサ計測値の保存に失敗しました'),
  },
})

app.openapi(route, async (c) => {
  // デバイス認証: 事前共有キーを Bearer トークンとして検証する。
  const auth = c.req.header('Authorization')
  if (!(await isValidIngestAuthorization(auth, c.env.SENSOR_INGEST_KEY))) {
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

app.openapi(environmentReadingRoute, async (c) => {
  const input = c.req.valid('json')
  const id = crypto.randomUUID()
  const recordedAt = new Date().toISOString()
  const supabase = getSupabaseAdmin(c.env)

  const { data, error } = await supabase
    .from('environment_readings')
    .insert({
      id,
      ...input,
      recorded_at: recordedAt,
    })
    .select('id, location_id, co2_ppm, occupancy, status, recorded_at, created_at')
    .single()

  if (error || !data) {
    throw new HTTPException(500, { message: '環境・混雑センサ計測値の保存に失敗しました' })
  }

  return c.json({ data }, 201)
})

export default app
