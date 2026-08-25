// Cloudflare Workers 実行時に注入される環境変数・シークレットの型定義。
// ローカルは .dev.vars、本番は Cloudflare Dashboard / `wrangler secret` で設定する。
export type Bindings = {
  // Supabase（PostgREST 経由のデータアクセス）
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  // 書き込み（センサデータ集約など）用。RLS をバイパスするため anon key ではなく service role key を使う。
  SUPABASE_SERVICE_ROLE_KEY: string
  // IoTデバイスがセンサデータ送信時に提示する事前共有キー（Authorization: Bearer <key>）。
  SENSOR_INGEST_KEY: string
  // Cloudflare R2 の公開バケットのベースURL（末尾スラッシュ不要）
  // 例: https://pub-xxxx.r2.dev  /  storage_path を連結してアセットURLを生成する
  R2_PUBLIC_BASE_URL: string
}
