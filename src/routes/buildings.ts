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

// 建物に属するスポット（ARマーカー）1件分。詳細・ARアセットは /api/v1/spots/{marker_id} で取得する。
const BuildingSpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  marker_id: z.string(),
})

const spotsRoute = createRoute({
  method: 'get',
  path: '/api/v1/buildings/{building_id}/spots',
  summary: '建物内スポット一覧取得',
  description: '指定した建物IDに紐づくスポット（ARマーカー）の一覧を名前順で取得する。',
  tags: ['Spots'],
  request: {
    params: z.object({
      building_id: z.string().openapi({
        param: {
          name: 'building_id',
          in: 'path',
        },
        example: 'uuid',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(BuildingSpotSchema),
          }),
        },
      },
      description: 'Get list of spots in the building',
    },
    400: errorResponse('リクエストの内容が不正です'),
    404: errorResponse('指定された建物が見つかりません'),
    500: errorResponse('スポット一覧の取得に失敗しました'),
  },
})

app.openapi(spotsRoute, async (c) => {
  const { building_id } = c.req.valid('param')
  const supabase = getSupabase(c.env)

  // 建物の存在確認とスポット取得を1クエリで行う（建物が無ければ null → 404）。
  const { data, error } = await supabase
    .from('buildings')
    .select('id, spots(id, name, description, marker_id)')
    .eq('id', building_id)
    .order('name', { referencedTable: 'spots' })
    .maybeSingle()

  if (error) {
    throw new HTTPException(500, { message: 'スポット一覧の取得に失敗しました' })
  }
  if (!data) {
    throw new HTTPException(404, { message: '指定された建物が見つかりません' })
  }

  type SpotRow = {
    id: string
    name: string
    description: string | null
    marker_id: string
  }

  const spots = ((data.spots ?? []) as SpotRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    marker_id: s.marker_id,
  }))

  return c.json({ data: spots }, 200)
})

export default app
