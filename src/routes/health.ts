import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

const HealthSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
})

const route = createRoute({
  method: 'get',
  path: '/api/health',
  summary: 'ヘルスチェック',
  description: 'APIの稼働状態を確認する。',
  tags: ['System'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthSchema,
        },
      },
      description: 'Health check API',
    },
  },
})

app.openapi(route, (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})

export default app
