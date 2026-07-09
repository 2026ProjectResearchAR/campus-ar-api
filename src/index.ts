import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

const app = new OpenAPIHono()

// トップページ（非APIエンドポイント）
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Swagger UIエンドポイント
app.get('/doc', swaggerUI({ url: '/openapi.json' }))

// OpenAPIのJSONスキーマ生成エンドポイント
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'Campus AR API',
  },
})

// === Zod スキーマ定義 ===
const HealthSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
})

const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  marker_count: z.number(),
})

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

const VisitSchema = z.object({
  spot_id: z.string(),
})

// === ルート定義 ===

// Health Check API
const healthRoute = createRoute({
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

app.openapi(healthRoute, (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})

// Buildings API
const buildingsRoute = createRoute({
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

app.openapi(buildingsRoute, (c) => {
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

// Spots API
const spotsRoute = createRoute({
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

app.openapi(spotsRoute, (c) => {
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

// 言った場所 API　（いらないかも）
const visitsRoute = createRoute({
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

app.openapi(visitsRoute, (c) => {
  return c.json({
    spot_id: "uuid"
  })
})

export default app