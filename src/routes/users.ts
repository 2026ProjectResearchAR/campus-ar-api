import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

const VisitSchema = z.object({
  spot_id: z.string(),
})

const route = createRoute({
  method: 'get',
  path: '/api/v1/users/me/visits',
  summary: '訪問履歴取得',
  description: 'ユーザーの訪問履歴を取得する。',
  tags: ['Users'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: VisitSchema,
        },
      },
      description: 'Get user visits',
    },
  },
})

app.openapi(route, (c) => {
  return c.json({
    spot_id: "uuid"
  })
})

export default app
