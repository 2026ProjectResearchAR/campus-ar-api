import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { createApp } from '../lib/app'
import { errorResponse } from '../lib/errors'
import { getSupabaseAdmin } from '../lib/supabase'

const app = createApp()

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

// environment_readings は RLS で非公開のため、サーバー側で場所を限定して読み出す。
const latestReadingRoute = createRoute({
  method: 'get',
  path: '/api/v1/sensors/readings/latest',
  summary: '場所別の最新センサ計測値の取得',
  description: 'location_id に一致する最新の環境・混雑センサ計測値を返す。未計測の場所は data: null。認証は不要。',
  tags: ['Sensors'],
  request: {
    query: z.object({ location_id: z.string().trim().min(1) }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ data: EnvironmentReadingSchema.nullable() }) } },
      description: '最新計測値（未計測の場合はnull）',
    },
    400: errorResponse('リクエストの内容が不正です'),
    500: errorResponse('環境・混雑センサ計測値の取得に失敗しました'),
  },
})

app.openapi(latestReadingRoute, async (c) => {
  const { location_id } = c.req.valid('query')
  const { data, error } = await getSupabaseAdmin(c.env)
    .from('environment_readings')
    .select('id, location_id, co2_ppm, occupancy, status, recorded_at, created_at')
    .eq('location_id', location_id)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new HTTPException(500, { message: '環境・混雑センサ計測値の取得に失敗しました' })
  }
  c.header('Cache-Control', 'no-store')
  return c.json({ data }, 200)
})

export default app
