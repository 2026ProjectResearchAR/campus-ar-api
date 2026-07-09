# Campus AR API

Campus AR API は、キャンパス内ARアプリケーションのバックエンドを提供するAPIサーバーです。Cloudflare Workers と [Hono](https://hono.dev/) を使用して構築されています。
OpenAPI 仕様に基づくバリデーションとドキュメント生成のために `@hono/zod-openapi` および Swagger UI を採用しています。

## ドキュメント

プロジェクトの詳細は [`docs`](docs) ディレクトリ内の各ドキュメントを参照してください：

- [要件定義 (Requirements)](docs/requirements.md) - プロジェクトの目的や機能要件について
- [アーキテクチャ (Architecture)](docs/architecture.md) - システム構成や技術スタックについて
- [仕様書 (Specifications)](docs/specifications.md) - APIの仕様やデータモデルについて

## 開発の始め方

依存パッケージのインストール:
```bash
npm install
```

ローカル開発サーバーの起動:
```bash
npm run dev
```
