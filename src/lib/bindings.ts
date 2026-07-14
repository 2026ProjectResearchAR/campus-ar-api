// Cloudflare Workers 実行時に注入される環境変数・シークレットの型定義。
// ローカルは .dev.vars、本番は Cloudflare Dashboard / `wrangler secret` で設定する。
export type Bindings = {
  // Supabase（PostgREST 経由のデータアクセス）
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  // Cloudflare R2 の公開バケットのベースURL（末尾スラッシュ不要）
  // 例: https://pub-xxxx.r2.dev  /  storage_path を連結してアセットURLを生成する
  R2_PUBLIC_BASE_URL: string
}
