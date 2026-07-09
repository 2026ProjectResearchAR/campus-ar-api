import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'

import healthApp from './routes/health'
import buildingsApp from './routes/buildings'
import spotsApp from './routes/spots'
import usersApp from './routes/users'

const app = new OpenAPIHono()

// トップページ（非APIエンドポイント）
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Swagger UIエンドポイント
app.get('/doc', swaggerUI({ url: '/openapi.json' }))

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
app.route('/', usersApp)

export default app