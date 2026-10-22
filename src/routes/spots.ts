import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { createApp } from '../lib/app'
import { errorResponse } from '../lib/errors'
import { getSupabase, toPublicAssetUrl } from '../lib/supabase'

const app = createApp()
const AR_CLIENT_URL = 'https://ar-cloud.chikai400up.workers.dev/'

const ARAssetSchema = z.object({
  type: z.string(),
  url: z.string(),
})

// スポットが属する建物（どの建物にARマーカーがあるかを示す）
const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const SpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  building: BuildingSchema,
  ar_assets: z.array(ARAssetSchema),
})

const route = createRoute({
  method: 'get',
  path: '/api/v1/spots/{marker_id}',
  summary: 'スポット詳細情報取得',
  description: 'スキャンしたARマーカーIDに紐づく詳細情報とARアセットを取得する。マーカーIDに @（%40 を含む）が含まれる場合は、DBを検索せずARクライアントのトップページへ302リダイレクトする。マーカーIDやクエリパラメータは転送しない。',
  tags: ['Spots'],
  request: {
    params: z.object({
      marker_id: z.string().openapi({
        param: {
          name: 'marker_id',
          in: 'path',
        },
        description: '@ を含む場合はARクライアントへリダイレクトする。例: @marker_fuzimotolab',
        example: 'uuid',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(SpotSchema)
          }),
        },
      },
      description: 'Get spots by marker ID',
    },
    302: {
      description: '@ を含むマーカーIDの場合、ARクライアントのトップページへリダイレクトする（レスポンスボディなし）。',
      headers: z.object({
        Location: z.string().url().openapi({
          description: 'リダイレクト先のURL',
          example: AR_CLIENT_URL,
        }),
      }),
    },
    400: errorResponse('リクエストの内容が不正です'),
    500: errorResponse('スポット情報の取得に失敗しました'),
  },
})

app.openapi(route, async (c) => {
  const { marker_id } = c.req.valid('param')

  if (marker_id.includes('@')) {
    return c.redirect(AR_CLIENT_URL, 302)
  }

  const supabase = getSupabase(c.env)

  // marker_id は一意。紐づく建物とARアセットを一括で取得する。
  const { data, error } = await supabase
    .from('spots')
    .select('id, name, description, building:buildings(id, name), ar_assets(type, storage_path)')
    .eq('marker_id', marker_id)

  if (error) {
    throw new HTTPException(500, { message: 'スポット情報の取得に失敗しました' })
  }

  type BuildingRef = { id: string; name: string }
  type SpotRow = {
    id: string
    name: string
    description: string | null
    // PostgREST の埋め込みは単一オブジェクト／配列いずれの形でも来うるため両対応する。
    building: BuildingRef | BuildingRef[] | null
    ar_assets: { type: string; storage_path: string }[] | null
  }

  const spots = ((data ?? []) as unknown as SpotRow[]).map((s) => {
    const building = Array.isArray(s.building) ? s.building[0] : s.building
    if (!building) {
      throw new HTTPException(500, { message: 'スポットに紐づく建物が見つかりません' })
    }
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      building: { id: building.id, name: building.name },
      ar_assets: (s.ar_assets ?? []).map((a) => ({
        type: a.type,
        url: toPublicAssetUrl(c.env, a.storage_path),
      })),
    }
  })

  return c.json({ data: spots }, 200)
})

export default app
