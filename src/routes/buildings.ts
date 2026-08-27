import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { createApp } from '../lib/app'
import { errorResponse } from '../lib/errors'
import { getSupabase } from '../lib/supabase'

const app = createApp()

const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  marker_count: z.number(),
})

const route = createRoute({
  method: 'get',
  path: '/api/v1/buildings',
  summary: '建物一覧取得',
  description: 'キャンパス内でARマーカーが設置されている建物（エリア）の一覧を取得する。',
  tags: ['Spots'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(BuildingSchema)
          }),
        },
      },
      description: 'Get list of buildings',
    },
    500: errorResponse('建物一覧の取得に失敗しました'),
  },
})

app.openapi(route, async (c) => {
  const supabase = getSupabase(c.env)

  // 建物ごとに紐づくスポット（=ARマーカー）数を集計する。
  const { data, error } = await supabase
    .from('buildings')
    .select('id, name, spots(count)')
    .order('name')

  if (error) {
    throw new HTTPException(500, { message: '建物一覧の取得に失敗しました' })
  }

  type BuildingRow = {
    id: string
    name: string
    spots: { count: number }[] | null
  }

  const buildings = ((data ?? []) as BuildingRow[]).map((b) => ({
    id: b.id,
    name: b.name,
    marker_count: b.spots?.[0]?.count ?? 0,
  }))

  return c.json({ data: buildings }, 200)
})

export default app
