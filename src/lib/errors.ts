import { z } from '@hono/zod-openapi'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

// エラー時のレスポンスは全エンドポイントで下記の形に統一する。
//   { "error": { "code": "not_found", "message": "...", "details": ... } }
// 成功時の { "data": ... } と対になる形。
export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: 'エラー種別を示す機械可読なコード',
        example: 'not_found',
      }),
      message: z.string().openapi({
        description: '人間向けのエラーメッセージ（日本語）',
        example: '指定されたリソースが見つかりません',
      }),
      details: z.unknown().optional().openapi({
        description: 'バリデーションエラーの詳細など、補足情報（任意）',
      }),
    }),
  })
  .openapi('Error')

export type ErrorBody = z.infer<typeof ErrorSchema>

// HTTPステータスコードから既定のエラーコードを引く。
const CODE_BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable_entity',
  429: 'too_many_requests',
  500: 'internal_server_error',
}

export function errorCodeFor(status: number): string {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'internal_server_error' : 'error')
}

export function errorBody(code: string, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } }
}

export function errorBodyFor(
  status: ContentfulStatusCode,
  message: string,
  details?: unknown
): ErrorBody {
  return errorBody(errorCodeFor(status), message, details)
}

// createRoute の responses に埋め込むためのヘルパー。
// 例: responses: { 404: errorResponse('指定されたセンサが見つかりません') }
export function errorResponse(description: string) {
  return {
    content: {
      'application/json': {
        schema: ErrorSchema,
      },
    },
    description,
  }
}
