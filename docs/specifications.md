# Campus AR API - API仕様書

## 1. 基本設定
*   **Base URL:** `https://api.campus-ar.example.com` (本番環境)
*   **Content-Type:** `application/json`
*   **認証:** ユーザー向けエンドポイント（`/api/v1/users/me/*`）はリクエストヘッダーに `Authorization: Bearer <JWT>`（Supabase Auth 発行の JWT）を含める。サーバは `supabase-js` の `getUser` でトークンを検証し、失敗時は `401` を返す。

## 2. エンドポイント一覧

### 2.1. ヘルスチェック
*   **GET `/api/health`**
    *   概要: APIの稼働状態を確認する。
    *   レスポンス: `200 OK` `{"status": "ok", "timestamp": "..."}`

### 2.2. スポット (POI)
*   **GET `/api/v1/buildings`**
    *   概要: キャンパス内でARマーカーが設置されている建物（エリア）の一覧を取得する。
    *   レスポンス:
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "name": "図書館",
              "marker_count": 3
            }
          ]
        }
        ```

*   **GET `/api/v1/spots/:marker_id`**
    *   概要: スキャンしたARマーカーIDに紐づく詳細情報とARアセットを取得する。マーカーIDで一意に探索する設計のため、緯度・経度は返さない（要件: 厳密な緯度・経度の照合は不要）。
    *   レスポンス:
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "name": "図書館前広場",
              "description": "図書館前のモニュメント",
              "building": {
                "id": "uuid",
                "name": "図書館"
              },
              "ar_assets": [
                {
                  "type": "3d_model",
                  "url": "https://r2.example.com/assets/library_mascot.glb"
                }
              ]
            }
          ]
        }
        ```

*   **POST `/api/v1/users/me/visits`**
    *   概要: ユーザーが特定のスポットを訪問（ARコンテンツを閲覧）したことを記録する。
    *   認証: `Authorization: Bearer <JWT>`（必須）。
    *   リクエストボディ:
        ```json
        {
          "spot_id": "uuid"
        }
        ```
    *   レスポンス: `201 Created`
        ```json
        {
          "data": {
            "id": "uuid",
            "spot_id": "uuid",
            "visited_at": "2026-01-01T00:00:00.000Z"
          }
        }
        ```
    *   エラー: `401`（認証トークンが無い／無効）。

*   **GET `/api/v1/users/me/visits`**
    *   概要: ユーザーの訪問履歴を一覧で取得する。
    *   認証: `Authorization: Bearer <JWT>`（必須）。
    *   レスポンス: `200 OK`
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "spot_id": "uuid",
              "visited_at": "2026-01-01T00:00:00.000Z"
            }
          ]
        }
        ```
    *   エラー: `401`（認証トークンが無い／無効）。

### 2.3. センサ (IoT)
*   **POST `/api/v1/sensors/:sensor_id/readings`**
    *   概要: 学内に設置したIoTデバイスから送信されるセンサ計測値を保存する。
    *   認証: `Authorization: Bearer <SENSOR_INGEST_KEY>`（デバイス用の事前共有キー）。
    *   リクエストボディ（`recorded_at` は省略時サーバ受信時刻を採用）:
        ```json
        {
          "value": 42,
          "recorded_at": "2026-01-01T00:00:00.000Z"
        }
        ```
    *   レスポンス: `201 Created`
        ```json
        {
          "data": {
            "id": "uuid",
            "sensor_id": "uuid",
            "value": 42,
            "recorded_at": "2026-01-01T00:00:00.000Z",
            "created_at": "2026-01-01T00:00:00.000Z"
          }
        }
        ```
    *   エラー: `401`（認証失敗）, `404`（`sensor_id` 不明）。

## 3. データベーススキーマ (Supabase / PostgreSQL) - 概要

*   **`users`**: Supabase Authによって管理（拡張プロファイルテーブルを作成）
*   **`buildings`**: `id`, `name`, `description` (建物やエリアの管理)
*   **`spots`**: `id`, `building_id` (外部キー), `name`, `description`, `marker_id` (ARマーカーとの紐付け用), `created_at`
*   **`ar_assets`**: `id`, `spot_id`, `type`, `storage_path`, `created_at`
*   **`events`**: `id`, `title`, `description`, `start_time`, `end_time`
*   **`user_visits`**: `id`, `user_id`, `spot_id`, `visited_at`
*   **`sensors`**: `id`, `building_id` (外部キー, NULL許容), `name`, `type` (例: `people_counter` / `co2` / `temperature`), `unit`, `created_at` (IoTデバイスのメタ情報)
*   **`sensor_readings`**: `id`, `sensor_id` (外部キー), `value`, `recorded_at` (デバイス側計測時刻), `created_at` (サーバ受信時刻) — 混雑需要予測の元となる時系列計測データ。`(sensor_id, recorded_at)` に複合インデックス

## 4. 開発・デプロイ手順

1.  **依存関係のインストール:** `npm install`
2.  **ローカル開発:** `npm run dev` (Wrangler を使用)
3.  **デプロイ:** `npm run deploy` (Wrangler を用いて Cloudflare にデプロイ)
4.  **環境変数:**
    *   Workers 実行時のシークレットは `.dev.vars`（ローカル）および Cloudflare Dashboard / `wrangler secret`（本番）に設定する。必要な変数は `.dev.vars.example` を参照。
        *   `SUPABASE_URL` / `SUPABASE_ANON_KEY`: PostgREST 経由の読み取りアクセス（`supabase-js`）に使用。
        *   `SUPABASE_SERVICE_ROLE_KEY`: センサ計測値の書き込み（RLS バイパス）に使用。クライアントには公開しない。
        *   `SENSOR_INGEST_KEY`: IoTデバイスがセンサデータ送信時に提示する事前共有キー。
        *   `R2_PUBLIC_BASE_URL`: 3Dモデル等の公開URL生成に使用（`storage_path` と連結）。
    *   Prisma（マイグレーション・スキーマ管理）が参照する `DIRECT_URL` は `.env.local` に置く（`prisma.config.ts` 参照）。
    *   いずれもコミットしない。

> **注意:** `buildings` / `spots` を anon key で読めるよう、Supabase 側で該当テーブルの RLS に anon の SELECT ポリシーを設定する（または RLS を無効化する）こと。設定がないとレスポンスが空になる。
