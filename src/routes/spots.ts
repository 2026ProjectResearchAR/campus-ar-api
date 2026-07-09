import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

const ARAssetSchema = z.object({
  type: z.string(),
  url: z.string(),
})

const SpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  description: z.string(),
  ar_assets: z.array(ARAssetSchema),
})

const route = createRoute({
  method: 'get',
  path: '/api/v1/spots/{marker_id}',
  summary: 'スポット詳細情報取得',
  description: 'スキャンしたARマーカーIDに紐づく詳細情報とARアセットを取得する。',
  tags: ['Spots'],
  request: {
    params: z.object({
      marker_id: z.string().openapi({
        param: {
          name: 'marker_id',
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
            data: z.array(SpotSchema)
          }),
        },
      },
      description: 'Get spots by marker ID',
    },
  },
})

app.openapi(route, (c) => {
  return c.json({
    data: [
      {
        id: "uuid",
        name: "図書館前広場",
        latitude: 35.000,
        longitude: 139.000,
        description: "図書館前のモニュメント",
        ar_assets: [
          {
            type: "3d_model",
            url: "https://r2.example.com/assets/library_mascot.glb"
          }
        ]
      }
    ]
  })
})

export default app
