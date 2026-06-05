import type { Quote } from '../types'

// 현재가(시세) 조회.
// 브라우저에서 네이버 금융을 직접 호출하면 CORS에 막히므로,
// 개발 서버(vite.config.ts의 server.proxy)를 통해 우회한다.
//   /naver-quote/{codes}  →  https://polling.finance.naver.com/api/realtime/domestic/stock/{codes}
// {codes}는 콤마로 묶어 여러 종목을 한 번에 조회한다(멀티-코드 엔드포인트).
// 프록시가 없는 환경(npm run preview, 정적 배포)에서는 실패하며,
// 이 경우 UI에서 수동 현재가 입력으로 폴백한다.

const ENDPOINT = '/naver-quote'

function toNumber(s: unknown): number {
  if (typeof s === 'number') return s
  if (typeof s !== 'string') return NaN
  return parseFloat(s.replace(/[,\s원]/g, ''))
}

export class QuoteFetchError extends Error {}

/** 네이버 응답 1건(datas[i]) → Quote. 유효하지 않으면 null. */
function parseDatum(data: Record<string, unknown>): Quote | null {
  const code = typeof data.itemCode === 'string' ? data.itemCode : undefined
  const price = toNumber(data.closePrice)
  if (!code || !isFinite(price) || price <= 0) return null
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

/**
 * 여러 종목 현재가를 한 번의 요청으로 조회(멀티-코드).
 * 성공분만 quotes에 담고, 응답에 없거나 실패한 종목은 errors에 모은다.
 */
export async function fetchQuotes(
  codes: string[],
): Promise<{ quotes: Quote[]; errors: { code: string; message: string }[] }> {
  const quotes: Quote[] = []
  if (codes.length === 0) return { quotes, errors: [] }

  const failAll = (message: string) => ({
    quotes,
    errors: codes.map((code) => ({ code, message })),
  })

  let res: Response
  try {
    res = await fetch(`${ENDPOINT}/${codes.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return failAll(
      '시세 서버에 연결할 수 없습니다. (자동 조회는 npm run dev 환경에서만 동작합니다)',
    )
  }
  if (!res.ok) return failAll(`시세 조회 실패 (HTTP ${res.status})`)

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return failAll('시세 응답을 해석할 수 없습니다.')
  }

  const datas = ((json as { datas?: unknown[] })?.datas ?? []) as Record<string, unknown>[]
  const byCode = new Map<string, Quote>()
  for (const d of datas) {
    const q = parseDatum(d)
    if (q) byCode.set(q.code, q)
  }

  const errors: { code: string; message: string }[] = []
  for (const code of codes) {
    const q = byCode.get(code)
    if (q) quotes.push(q)
    else errors.push({ code, message: '해당 종목 시세를 찾을 수 없습니다.' })
  }
  return { quotes, errors }
}

/** 단일 종목 현재가 조회. 실패 시 QuoteFetchError throw. */
export async function fetchQuote(code: string): Promise<Quote> {
  const { quotes, errors } = await fetchQuotes([code])
  if (quotes[0]) return quotes[0]
  throw new QuoteFetchError(errors[0]?.message ?? '시세 조회 실패')
}
