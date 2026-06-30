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
*   **GET `/api/v1/spots`**
    *   概要: キャンパス内のスポット一覧を取得する。
    *   クエリパラメータ:
        *   `lat` (number): 緯度
        *   `lng` (number): 経度
        *   `radius` (number): 検索半径（メートル）
    *   レスポンス:
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "name": "図書館前広場",
              "latitude": 35.xxx,
              "longitude": 139.xxx,
              "description": "図書館前のモニュメント",
              "ar_assets": [
                {
                  "type": "3d_model",
                  "url": "https://r2.example.com/assets/library_mascot.gltf"
                }
              ]
            }
          ]
        }
        ```

*   **GET `/api/v1/spots/:id`**
    *   概要: 特定のスポットの詳細情報を取得する。

### 2.3. イベント
*   **GET `/api/v1/events`**
    *   概要: 開催中のイベント一覧を取得する。

### 2.4. ユーザーアクティビティ (要認証)
*   **POST `/api/v1/users/me/visits`**
    *   概要: ユーザーが特定のスポットを訪問・チェックインした記録を保存する。
    *   リクエストボディ:
        ```json
        {
          "spot_id": "uuid"
        }
        ```
    *   レスポンス: `201 Created`

*   **GET `/api/v1/users/me/visits`**
    *   概要: ユーザーの訪問履歴を取得する。

## 3. データベーススキーマ (Supabase / PostgreSQL) - 概要

*   **`users`**: Supabase Authによって管理（拡張プロファイルテーブルを作成）
*   **`spots`**: `id`, `name`, `description`, `location (PostGIS Geometry)`, `created_at`
*   **`ar_assets`**: `id`, `spot_id`, `type`, `storage_path`, `created_at`
*   **`events`**: `id`, `title`, `description`, `start_time`, `end_time`
*   **`user_visits`**: `id`, `user_id`, `spot_id`, `visited_at`

## 4. 開発・デプロイ手順

1.  **依存関係のインストール:** `npm install`
2.  **ローカル開発:** `npm run dev` (Wrangler を使用)
3.  **デプロイ:** `npm run deploy` (Wrangler を用いて Cloudflare にデプロイ)
4.  **環境変数:** SupabaseのURL、Anon Key、R2の設定などは `.dev.vars` および Cloudflare Dashboard に設定する。
