import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// テストは本番と同じ workerd ランタイム上で実行する（@cloudflare/vitest-pool-workers）。
// wrangler.jsonc を読み込むため、compatibility_date やバインディングの設定が本番と揃う。
// 環境変数（シークレット）はテストごとに test/helpers.ts の TEST_ENV を
// app.request() の第3引数として明示的に渡すため、ここでは定義しない。
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
