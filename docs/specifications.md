# Campus AR API - API仕様書

## 1. 基本設定
*   **Base URL:** `https://api.campus-ar.example.com` (本番環境)
*   **Content-Type:** `application/json`
*   **認証:** ユーザー向けエンドポイント（`/api/v1/users/me/*`）はリクエストヘッダーに `Authorization: Bearer <JWT>`（Supabase Auth 発行の JWT）を含める。サーバは `supabase-js` の `getUser` でトークンを検証し、失敗時は `401` を返す。

## 1.1. 共通のエラーレスポンス

エラー時は、HTTPステータスコードに関わらず全エンドポイントで下記の形式を返す（成功時の `{"data": ...}` と対になる形）。

```json
{
  "error": {
    "code": "not_found",
    "message": "指定されたセンサが見つかりません"
  }
}
```

*   `code`: エラー種別を示す機械可読な文字列。クライアントはこの値で分岐する。
*   `message`: 人間向けの日本語メッセージ。UIにそのまま出す用途は想定しない。
*   `details`: 任意。リクエストバリデーション失敗時は Zod の issue 配列が入る。

| ステータス | `code` | 発生条件 |
| :-- | :-- | :-- |
| 400 | `bad_request` | パス/クエリ/ボディのバリデーション失敗 |
| 401 | `unauthorized` | 認証情報が無い、または不正 |
| 403 | `forbidden` | 権限不足 |
| 404 | `not_found` | リソース、または存在しないエンドポイント |
| 409 | `conflict` | 一意制約違反など |
| 500 | `internal_server_error` | サーバ内部エラー（詳細はクライアントに返さない） |

実装は `src/lib/errors.ts`（スキーマ・ヘルパー）、`src/lib/app.ts`（バリデーション失敗時の `defaultHook`）、`src/index.ts`（`app.onError` / `app.notFound`）に集約されている。

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

*   **GET `/api/v1/buildings/:building_id/spots`**
    *   概要: 指定した建物IDに紐づくスポット（ARマーカー）の一覧を名前順で取得する。各スポットの詳細・ARアセットは `GET /api/v1/spots/:marker_id` で取得する。
    *   レスポンス: `200 OK`
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "name": "図書館前広場",
              "description": "図書館前のモニュメント",
              "marker_id": "marker-001"
            }
          ]
        }
        ```
    *   エラー: `404`（指定された建物が存在しない）。スポットが未登録の建物は `data: []` を返す。

*   **GET `/api/v1/spots/:marker_id`**
    *   概要: スキャンしたARマーカーIDに紐づく詳細情報とARアセットを取得する。マーカーIDで一意に探索する設計のため、緯度・経度は返さない（要件: 厳密な緯度・経度の照合は不要）。
    *   リダイレクト: `marker_id` に `@` が含まれる場合（URLエンコードされた `%40` も対象）、DBを検索せず `302 Found` を返す。`Location` ヘッダーは `https://ar-cloud.chikai400up.workers.dev/`、レスポンスボディは空。マーカーIDやクエリパラメータは転送しない。例: `/api/v1/spots/@marker_fuzimotolab`。クエリパラメータ内だけの `@` は対象外。
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
*   **GET `/api/v1/sensors/readings/latest?location_id={location_id}`**
    *   概要: 指定場所の最新の環境・混雑センサ計測値を取得する。認証不要。
    *   `location_id`: 必須の空でない文字列。POSTで保存したIDと完全一致で検索する。
    *   マップ連携では `buildings.id` を `location_id` として送信する（clientの表示用連番とは異なる）。
    *   レスポンス: `200 { "data": { "id", "location_id", "co2_ppm", "occupancy", "status", "recorded_at", "created_at" } }`。フィールドの形式はPOSTのレスポンスと同じ。未計測は `200 { "data": null }`。
    *   `recorded_at`、`created_at`、`id` の降順で最新1件を返す。キャッシュは `Cache-Control: no-store`。
    *   エラー: ID未指定・空文字は400、DB取得失敗は500（共通エラー形式）。
    *   RLSで非公開のテーブルをservice roleで読み出す。キーはサーバー内のみで使用する。

*   **POST `/api/v1/sensors/readings`**
    *   概要: ハードウェアから1分ごとに送信される場所別のCO2濃度・周辺人数・混雑状態を保存する。計測時刻にはサーバー受信時刻を採用する。
    *   認証: 不要。`Content-Type: application/json` で送信する。
    *   リクエストボディ:
        ```json
        {
          "location_id": "building_1",
          "co2_ppm": 850,
          "occupancy": 7,
          "status": "moderate"
        }
        ```
        * `co2_ppm`: 0以上の数値
        * `occupancy`: 0〜2147483647の整数（DBのINTEGER範囲）
        * `status`: `crowded` / `moderate` / `vacant` のいずれか
        * `location_id`: 空でない設置場所識別子。現時点ではハード班の識別子を保存し、`buildings.id` との外部キー連携は行わない。
    *   保存: POSTごとに履歴を1件追加する。送信時刻が含まれないため、再送も別レコードになる。1分間隔は送信側の仕様であり、API側では間隔を制限しない。
    *   レスポンス: `201 Created`
        ```json
        {
          "data": {
            "id": "uuid",
            "location_id": "building_1",
            "co2_ppm": 850,
            "occupancy": 7,
            "status": "moderate",
            "recorded_at": "2026-10-22T00:00:00.000Z",
            "created_at": "2026-10-22T00:00:00.000Z"
          }
        }
        ```
    *   エラー: `400`（入力値不正）, `500`（保存失敗）。
    *   新しい環境で利用する場合は `20261022000000_add_environment_readings` マイグレーションの適用が必要。設定済みSupabaseには2026-10-23に適用済み。新規テーブルはRLS有効で、APIのservice role経由でアクセスする。

### 2.4. イベント
*   **GET `/api/v1/events`**
    *   概要: キャンパス内で開催されるイベント情報の一覧を開始時刻の昇順で取得する。
    *   クエリパラメータ（任意）:
        *   `upcoming`: `true` を指定すると、終了していない（`end_time` が現在時刻以降の）イベントのみを返す。
    *   レスポンス: `200 OK`
        ```json
        {
          "data": [
            {
              "id": "uuid",
              "title": "オープンキャンパス",
              "description": "学部紹介と模擬授業",
              "start_time": "2026-01-01T00:00:00.000Z",
              "end_time": "2026-01-01T00:00:00.000Z"
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
*   **`sensors`**: `id`, `building_id` (外部キー, NULL許容), `name`, `type` (例: `people_counter` / `co2` / `temperature`), `unit`, `created_at` (IoTデバイスのメタ情報)
*   **`sensor_readings`**: `id`, `sensor_id` (外部キー), `value`, `recorded_at` (デバイス側計測時刻), `created_at` (サーバ受信時刻) — 混雑需要予測の元となる時系列計測データ。`(sensor_id, recorded_at)` に複合インデックス
*   **`environment_readings`**: `id`, `location_id`, `co2_ppm`, `occupancy`, `status`, `recorded_at`, `created_at` — ハードウェアから受信した場所別の環境・混雑時系列データ。`status` は `crowded` / `moderate` / `vacant`。`(location_id, recorded_at)` に複合インデックス

## 4. 開発・デプロイ手順

1.  **依存関係のインストール:** `npm install`
2.  **ローカル開発:** `npm run dev` (Wrangler を使用)
3.  **型チェック:** `npm run typecheck` — Cloudflare Bindings の型を再生成（`wrangler types`）してから `tsc --noEmit` を実行する。GitHub Actions（`.github/workflows/ci.yaml`）が `main` / `develop` 向けのPR・pushで同じコマンドを走らせる。
4.  **デプロイ:** `npm run deploy` (Wrangler を用いて Cloudflare にデプロイ)
5.  **環境変数:**
    *   Workers 実行時のシークレットは `.dev.vars`（ローカル）および Cloudflare Dashboard / `wrangler secret`（本番）に設定する。必要な変数は `.dev.vars.example` を参照。
        *   `SUPABASE_URL` / `SUPABASE_ANON_KEY`: PostgREST 経由の読み取りアクセス（`supabase-js`）に使用。
        *   `SUPABASE_SERVICE_ROLE_KEY`: センサ計測値の書き込み（RLS バイパス）に使用。クライアントには公開しない。
        *   `R2_PUBLIC_BASE_URL`: 3Dモデル等の公開URL生成に使用（`storage_path` と連結）。
    *   Prisma（マイグレーション・スキーマ管理）が参照する `DIRECT_URL` は `.env.local` に置く（`prisma.config.ts` 参照）。
    *   いずれもコミットしない。

> **注意:** `buildings` / `spots` を anon key で読めるよう、Supabase 側で該当テーブルの RLS に anon の SELECT ポリシーを設定する（または RLS を無効化する）こと。設定がないとレスポンスが空になる。
