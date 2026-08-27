import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import type { Bindings } from './lib/bindings'
import { errorBody, errorBodyFor } from './lib/errors'
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

// === エラーハンドリング ===
// 全エンドポイントのエラーレスポンスを { error: { code, message } } 形式に統一する。
// サブアプリ（src/routes/*）で throw された HTTPException もここに集約される。
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(errorBodyFor(err.status, err.message), err.status)
  }

  // 想定外の例外は詳細をクライアントに漏らさず、ログにのみ残す。
  console.error(err)
  return c.json(errorBodyFor(500, 'サーバー内部でエラーが発生しました'), 500)
})

app.notFound((c) => {
  return c.json(errorBody('not_found', '指定されたエンドポイントが存在しません'), 404)
})

// === ルーティングの登録 ===
app.route('/', healthApp)
app.route('/', buildingsApp)
app.route('/', spotsApp)
app.route('/', sensorsApp)
app.route('/', usersApp)
app.route('/', eventsApp)

export default app