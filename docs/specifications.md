# Campus AR API - API仕様書

## 1. 基本設定
*   **Base URL:** `https://api.campus-ar.example.com` (本番環境)
*   **Content-Type:** `application/json`
*   **認証:** リクエストヘッダーに `Authorization: Bearer <JWT>` を含める。

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

*   **GET `/api/v1/users/me/visits`**
    *   概要: ユーザーの訪問履歴を一覧で取得する。
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

## 3. データベーススキーマ (Supabase / PostgreSQL) - 概要

*   **`users`**: Supabase Authによって管理（拡張プロファイルテーブルを作成）
*   **`buildings`**: `id`, `name`, `description` (建物やエリアの管理)
*   **`spots`**: `id`, `building_id` (外部キー), `name`, `description`, `marker_id` (ARマーカーとの紐付け用), `created_at`
*   **`ar_assets`**: `id`, `spot_id`, `type`, `storage_path`, `created_at`
*   **`events`**: `id`, `title`, `description`, `start_time`, `end_time`
*   **`user_visits`**: `id`, `user_id`, `spot_id`, `visited_at`

## 4. 開発・デプロイ手順

1.  **依存関係のインストール:** `npm install`
2.  **ローカル開発:** `npm run dev` (Wrangler を使用)
3.  **デプロイ:** `npm run deploy` (Wrangler を用いて Cloudflare にデプロイ)
4.  **環境変数:**
    *   Workers 実行時のシークレット（Supabase の URL / Anon Key、R2 設定など）は `.dev.vars`（ローカル）および Cloudflare Dashboard / `wrangler secret`（本番）に設定する。
    *   Prisma（マイグレーション・スキーマ管理）が参照する `DIRECT_URL` は `.env.local` に置く（`prisma.config.ts` 参照）。
    *   いずれもコミットしない。
