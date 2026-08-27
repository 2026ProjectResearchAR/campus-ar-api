import { OpenAPIHono } from '@hono/zod-openapi'

import type { Bindings } from './bindings'
import { errorBody } from './errors'

// 各ルートファイルはこのファクトリ経由で OpenAPIHono を生成する。
// defaultHook はコンストラクタ単位でしか設定できないため、
// リクエストバリデーション失敗時のレスポンス形式を全ルートで揃える目的で共通化している。
//
// 認証ミドルウェアなどで c.set/c.get を使うルートは、型引数で Variables を渡す。
//   例: createApp<AuthVariables>()
export function createApp<V extends Record<string, unknown> = {}>() {
  return new OpenAPIHono<{ Bindings: Bindings; Variables: V }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody('bad_request', 'リクエストの内容が不正です', result.error.issues),
          400
        )
      }
    },
  })
}
