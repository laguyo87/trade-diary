import type { Quote } from '../types'

// 현재가(시세) 조회.
// 브라우저에서 네이버 금융을 직접 호출하면 CORS에 막히므로,
// 개발 서버(vite.config.ts의 server.proxy)를 통해 우회한다.
//   /naver-quote/{code}  →  https://polling.finance.naver.com/api/realtime/domestic/stock/{code}
// 프록시가 없는 환경(npm run preview, 정적 배포)에서는 실패하며,
// 이 경우 UI에서 수동 현재가 입력으로 폴백한다.

const ENDPOINT = '/naver-quote'

function toNumber(s: unknown): number {
  if (typeof s === 'number') return s
  if (typeof s !== 'string') return NaN
  return parseFloat(s.replace(/[,\s원]/g, ''))
}

export class QuoteFetchError extends Error {}

/** 단일 종목 현재가 조회. 실패 시 QuoteFetchError throw. */
export async function fetchQuote(code: string): Promise<Quote> {
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}/${code}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new QuoteFetchError(
      '시세 서버에 연결할 수 없습니다. (개발 서버 npm run dev 에서만 자동 조회가 동작합니다)',
    )
  }
  if (!res.ok) {
    throw new QuoteFetchError(`시세 조회 실패 (HTTP ${res.status})`)
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new QuoteFetchError('시세 응답을 해석할 수 없습니다.')
  }

  const data = (json as { datas?: unknown[] })?.datas?.[0] as
    | Record<string, unknown>
    | undefined
  if (!data) throw new QuoteFetchError('해당 종목 시세를 찾을 수 없습니다.')

  const price = toNumber(data.closePrice)
  if (!isFinite(price) || price <= 0) {
    throw new QuoteFetchError('유효한 현재가를 받지 못했습니다.')
  }

  const changeRate = toNumber(data.fluctuationsRatio)

  return {
    code,
    price,
    name: typeof data.stockName === 'string' ? data.stockName : undefined,
    changeRate: isFinite(changeRate) ? changeRate : undefined,
    marketStatus: typeof data.marketStatus === 'string' ? data.marketStatus : undefined,
    updatedAt: new Date().toISOString(),
    manual: false,
  }
}

/** 여러 종목을 순차 조회. 성공분만 반환하고 실패는 errors에 모은다. */
export async function fetchQuotes(
  codes: string[],
): Promise<{ quotes: Quote[]; errors: { code: string; message: string }[] }> {
  const quotes: Quote[] = []
  const errors: { code: string; message: string }[] = []
  for (const code of codes) {
    try {
      quotes.push(await fetchQuote(code))
    } catch (e) {
      errors.push({ code, message: e instanceof Error ? e.message : '알 수 없는 오류' })
    }
  }
  return { quotes, errors }
}
