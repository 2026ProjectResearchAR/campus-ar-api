import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

import type { Bindings } from '../lib/bindings'
import { requireAuth, type AuthVariables } from '../lib/auth'

const app = new OpenAPIHono<{ Bindings: Bindings; Variables: AuthVariables }>()

// users/me/* は Supabase Auth の JWT による認証を必須とする。
app.use('/api/v1/users/me/*', requireAuth)

// 訪問記録（1件）のスキーマ
const VisitSchema = z.object({
  id: z.string(),
  spot_id: z.string(),
  visited_at: z.string(),
})

// 訪問記録の作成: POST /api/v1/users/me/visits
const createVisitRoute = createRoute({
  method: 'post',
  path: '/api/v1/users/me/visits',
  summary: '訪問記録の作成',
  description:
    'ユーザーが特定のスポットを訪問（ARコンテンツを閲覧）したことを記録する。Authorization: Bearer <JWT> による認証が必要。',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            spot_id: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            data: VisitSchema,
          }),
        },
      },
      description: 'Visit recorded',
    },
    401: { description: 'Unauthorized' },
  },
})

// 訪問履歴の取得: GET /api/v1/users/me/visits
const listVisitsRoute = createRoute({
  method: 'get',
  path: '/api/v1/users/me/visits',
  summary: '訪問履歴取得',
  description: 'ユーザーの訪問履歴を一覧で取得する。Authorization: Bearer <JWT> による認証が必要。',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(VisitSchema),
          }),
        },
      },
      description: 'Get user visits',
    },
    401: { description: 'Unauthorized' },
  },
})

app.openapi(createVisitRoute, (c) => {
  // 認証ミドルウェアが特定したユーザーID。訪問記録の所有者として利用する（DB接続時に使用）。
  const userId = c.get('userId')
  const { spot_id } = c.req.valid('json')

  // TODO: user_visits テーブルへ実データで INSERT する（現状はモック返却）。
  return c.json(
    {
      data: {
        id: 'uuid',
        spot_id,
        visited_at: new Date().toISOString(),
      },
    },
    201
  )
})

app.openapi(listVisitsRoute, (c) => {
  // 認証ミドルウェアが特定したユーザーID。この値で user_visits を絞り込む（DB接続時に使用）。
  const userId = c.get('userId')

  // TODO: user_visits テーブルから userId の訪問履歴を SELECT する（現状はモック返却）。
  return c.json({
    data: [
      {
        id: 'uuid',
        spot_id: 'uuid',
        visited_at: new Date().toISOString(),
      },
    ],
  })
})

export default app
