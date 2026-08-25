# AGENTS.md

このファイルは、AIコーディングエージェント（Claude Code など）が本リポジトリで作業する際のガイドラインです。人間の開発者にとってもオンボーディング資料として役立ちます。

## プロジェクト概要

Campus AR API は、キャンパス内ARアプリケーション（`campus-ar-client`）のバックエンドを提供するAPIサーバーです。ARマーカーや位置情報に基づき、AR案内・イベント情報・バーチャル展示などのコンテンツをクライアントへ配信します。

- **Web Framework:** [Hono](https://hono.dev/)（エッジ最適化の軽量フレームワーク）
- **Runtime / Deploy:** [Cloudflare Workers](https://workers.cloudflare.com/)（Wrangler 経由）
- **DB / Auth:** [Supabase](https://supabase.com/)（PostgreSQL + Auth）、ORM は [Prisma](https://www.prisma.io/)
- **Object Storage:** [Cloudflare R2](https://developers.cloudflare.com/r2/)（3Dモデル `.glb` などのARアセット）
- **API定義:** [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) による OpenAPI 3.1 スキーマ生成 + Swagger UI
- **言語:** TypeScript（ESM, strict モード）

詳細な背景は [`docs/`](docs) を参照してください。

- [要件定義 (requirements.md)](docs/requirements.md)
- [アーキテクチャ (architecture.md)](docs/architecture.md)
- [API仕様 (specifications.md)](docs/specifications.md)

## セットアップとコマンド

```bash
npm install          # 依存パッケージのインストール
npm run dev          # ローカル開発サーバー起動 (wrangler dev)
npm run deploy       # Cloudflare へデプロイ (wrangler deploy --minify)
npm run cf-typegen   # Cloudflare Bindings の型定義を生成
```

Prisma 関連:

```bash
npx prisma generate         # Prisma Client を生成
npx prisma migrate dev      # マイグレーション作成・適用（ローカル）
npx prisma migrate deploy   # マイグレーション適用（デプロイ環境）
```

### ローカル動作確認

- 開発サーバー起動後、Swagger UI が `http://localhost:8787/doc` で閲覧できます。
- OpenAPI JSON は `http://localhost:8787/openapi.json` から取得できます。
- ヘルスチェック: `GET /api/health`

## ディレクトリ構成

```
src/
  index.ts          # エントリポイント。OpenAPIHono の初期化とルート登録、Swagger UI 設定
  routes/           # エンドポイントごとのルート定義（1ファイル1リソース）
    health.ts       # GET /api/health
    buildings.ts    # GET /api/v1/buildings
    spots.ts        # GET /api/v1/spots/{marker_id}
    users.ts        # GET /api/v1/users/me/visits
prisma/
  schema.prisma     # DBスキーマ定義（モデル）
  migrations/       # マイグレーションSQL
docs/               # 要件・アーキテクチャ・API仕様のドキュメント
wrangler.jsonc      # Cloudflare Workers の設定
prisma.config.ts    # Prisma の設定（datasource URL は環境変数から取得）
```

## コーディング規約

### ルート定義（src/routes/）

- 1リソース = 1ファイル。各ファイルは `new OpenAPIHono()` したインスタンスを `export default` する。
- 新規ルートを追加したら、`src/index.ts` で import して `app.route('/', xxxApp)` に登録する（登録を忘れると公開されません）。
- ルートは `createRoute({ method, path, summary, description, tags, request, responses })` で定義し、`app.openapi(route, handler)` でハンドラを紐づける。
- リクエスト・レスポンスのスキーマは必ず `zod`（`import { z } from '@hono/zod-openapi'`）で定義する。これが OpenAPI ドキュメントとバリデーションの両方の源泉になる。
- `summary` / `description` は日本語で記述する（既存ルートに準拠）。
- `tags` は Swagger UI 上のグルーピングに使う（例: `System`, `Spots`, `Users`）。
- パスは `/api/health`（システム系）と `/api/v1/...`（バージョン付きAPI）を使い分ける既存慣習に従う。

現状のハンドラはモックデータ（`data: [...]`）を返す段階です。DB接続を実装する際は Prisma Client を用い、レスポンス形状は既存のZodスキーマを崩さないようにしてください。

### 命名規約（DB / API）

- **Prisma モデル:** フィールドは camelCase、DBカラムは `@map` で snake_case にマッピングする（例: `buildingId String @map("building_id")`）。テーブル名は `@@map` で snake_case 複数形（例: `@@map("spots")`）。
- **APIレスポンス:** JSONのキーは snake_case（例: `marker_count`, `ar_assets`, `spot_id`）。

### TypeScript

- ESM（`package.json` の `"type": "module"`）。相対 import には拡張子を付けない既存スタイルに合わせる。
- `strict: true`。`any` は避け、Zodスキーマから型を導出する。
- JSX を使う場合は `hono/jsx`（`tsconfig.json` の `jsxImportSource`）。

## 環境変数・シークレット

- ローカル用の値は `.env.local` に置く（Prisma は `.env.local` / `.env` を読み込む。`prisma.config.ts` 参照）。
- `.env.local` はコミットしない。
- Supabase の URL / キーや R2 の設定など、Workers 実行時のシークレットは Cloudflare Dashboard または `wrangler secret` で管理する。ソースにハードコードしない。
- Prisma の `DIRECT_URL`（datasource URL）は環境変数から取得する。

## Git / PR の運用

- **ブランチ運用:** `main`（本番）← `develop`（開発統合）。作業ブランチは `develop` から切る。
- **ブランチ名:** `<担当者名>/<種別>/<内容>` の形式（例: `maegawa/feature/api`, `mitani/feature/docs`）。種別は `feature` / `fix` / `docs` など。
- **コミットメッセージ:** `種別: 内容` のプレフィックス形式。種別は以下を基本とする。必要に応じて新しいプレフィックスを追加してもよい。
  - `add:` — ファイルや機能の追加
  - `fix:` — バグ修正
  - `update:` — 既存の変更・改善
  - `delete:` — ファイルや機能の削除
- **PR:** 原則 `develop` に向けて出す。本番反映は `develop` → `main`。

## エージェント向けの注意

- **勝手にコミット・プッシュしない:** ユーザーから明示的に指示された場合のみコミット/プッシュ/PR作成を行う。
- **秘匿情報を出力しない:** `.env.local` やシークレットの中身をログ・PR・コミットに含めない。
- **スキーマの一貫性を保つ:** ルートを変更したら OpenAPI（Zod）定義・`docs/specifications.md`・Prisma スキーマの整合を確認する。
- **`node_modules/` や自動生成物は編集しない**（`package-lock.json` は依存変更時のみ）。
- 破壊的・不可逆な操作（マイグレーションの適用、デプロイ）はユーザーの確認を取ってから実行する。
