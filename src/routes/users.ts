import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

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
  description: 'ユーザーが特定のスポットを訪問（ARコンテンツを閲覧）したことを記録する。',
  tags: ['Users'],
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
  },
})

// 訪問履歴の取得: GET /api/v1/users/me/visits
const listVisitsRoute = createRoute({
  method: 'get',
  path: '/api/v1/users/me/visits',
  summary: '訪問履歴取得',
  description: 'ユーザーの訪問履歴を一覧で取得する。',
  tags: ['Users'],
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
  },
})

app.openapi(createVisitRoute, (c) => {
  return c.json(
    {
      data: {
        id: "uuid",
        spot_id: "uuid",
        visited_at: new Date().toISOString(),
      },
    },
    201
  )
})

app.openapi(listVisitsRoute, (c) => {
  return c.json({
    data: [
      {
        id: "uuid",
        spot_id: "uuid",
        visited_at: new Date().toISOString(),
      },
    ],
  })
})

export default app
