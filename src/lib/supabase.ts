import { createClient } from '@supabase/supabase-js'

import type { Bindings } from './bindings'

// リクエストごとに Supabase クライアントを生成する。
// Cloudflare Workers 上では fetch ベースの PostgREST 経由でアクセスするため、
// セッションの永続化は不要（persistSession: false）。
export function getSupabase(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// 書き込み用の Supabase クライアント。service role key を使い RLS をバイパスする。
// センサデータ集約など、デバイス/サーバ側からの insert に使用する（クライアントには公開しない）。
export function getSupabaseAdmin(env: Bindings) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// R2 の storage_path を公開URLに変換する。
export function toPublicAssetUrl(env: Bindings, storagePath: string): string {
  const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
  const path = storagePath.replace(/^\/+/, '')
  return `${base}/${path}`
}
