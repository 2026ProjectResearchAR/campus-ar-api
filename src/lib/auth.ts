import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { Bindings } from './bindings'
import { getSupabase } from './supabase'

// 認証済みユーザー情報を Hono のコンテキストに載せるための型。
// requireAuth を通過したハンドラでは c.get('userId') が必ず取得できる。
export type AuthVariables = {
  userId: string
  userEmail: string | null
}

// Supabase Auth が発行した JWT を検証するミドルウェア。
// Authorization: Bearer <JWT> を取り出し、Supabase Auth サーバ側で検証してユーザーを特定する。
// 検証は supabase-js の getUser(token) に委譲する（署名検証・失効反映を Supabase 側で行う）。
export const requireAuth = createMiddleware<{
  Bindings: Bindings
  Variables: AuthVariables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: '認証トークンが必要です' })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    throw new HTTPException(401, { message: '認証トークンが必要です' })
  }

  // anon キーのクライアントに JWT を渡し、Supabase Auth 側でトークンを検証する。
  const supabase = getSupabase(c.env)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new HTTPException(401, { message: '認証に失敗しました' })
  }

  c.set('userId', data.user.id)
  c.set('userEmail', data.user.email ?? null)

  await next()
})
