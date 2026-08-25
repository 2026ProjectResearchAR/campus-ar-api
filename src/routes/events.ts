import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import type { Bindings } from '../lib/bindings'
import { getSupabase } from '../lib/supabase'

const app = new OpenAPIHono<{ Bindings: Bindings }>()

// イベント1件のレスポンススキーマ（JSONキーは snake_case）
const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
})

const route = createRoute({
  method: 'get',
  path: '/api/v1/events',
  summary: 'イベント一覧取得',
  description:
    'キャンパス内で開催されるイベント情報の一覧を開始時刻の昇順で取得する。upcoming=true を指定すると、終了していない（現在時刻以降に終了する）イベントのみを返す。',
  tags: ['Events'],
  request: {
    query: z.object({
      upcoming: z
        .enum(['true', 'false'])
        .optional()
        .openapi({
          param: { name: 'upcoming', in: 'query' },
          description: 'true の場合、終了していないイベントのみを返す。',
          example: 'true',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(EventSchema),
          }),
        },
      },
      description: 'Get list of events',
    },
  },
})

app.openapi(route, async (c) => {
  const { upcoming } = c.req.valid('query')
  const supabase = getSupabase(c.env)

  let query = supabase
    .from('events')
    .select('id, title, description, start_time, end_time')
    .order('start_time', { ascending: true })

  // upcoming=true のときは終了時刻が現在時刻以降のイベントのみに絞り込む。
  if (upcoming === 'true') {
    query = query.gte('end_time', new Date().toISOString())
  }

  const { data, error } = await query

  if (error) {
    throw new HTTPException(500, { message: 'イベント一覧の取得に失敗しました' })
  }

  return c.json({ data: data ?? [] })
})

export default app
