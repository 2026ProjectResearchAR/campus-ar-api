import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

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
  },
})

app.openapi(route, (c) => {
  return c.json({
    data: [
      {
        id: "uuid",
        name: "図書館",
        marker_count: 3
      }
    ]
  })
})

export default app
