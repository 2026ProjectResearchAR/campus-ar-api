import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'

import type { Bindings } from './lib/bindings'
import healthApp from './routes/health'
import buildingsApp from './routes/buildings'
import spotsApp from './routes/spots'
import sensorsApp from './routes/sensors'
import usersApp from './routes/users'
import eventsApp from './routes/events'

const app = new OpenAPIHono<{ Bindings: Bindings }>()

// トップページ（非APIエンドポイント）
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Swagger UIエンドポイント
app.get('/doc', swaggerUI({ url: '/openapi.json' }))

// Supabase Auth の JWT を用いた Bearer 認証スキーム（users/me/* などで使用）
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

// OpenAPIのJSONスキーマ生成のためのエンドポイント
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'Campus AR API',
  },
})

// === ルーティングの登録 ===
app.route('/', healthApp)
app.route('/', buildingsApp)
app.route('/', spotsApp)
app.route('/', sensorsApp)
app.route('/', usersApp)
app.route('/', eventsApp)

export default app