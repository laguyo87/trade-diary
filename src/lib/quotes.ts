import type { Quote } from '../types'

// 현재가(시세) 조회.
// 1) Electron 데스크톱 앱: 메인 프로세스(window.quoteApi)가 네이버를 직접
//    호출하므로 CORS 제약이 없다.
// 2) 웹 개발 서버: vite.config.ts의 server.proxy로 우회한다.
//      /naver-quote/{codes} → https://polling.finance.naver.com/api/realtime/domestic/stock/{codes}
// {codes}는 콤마로 묶어 여러 종목을 한 번에 조회한다(멀티-코드 엔드포인트).
// 둘 다 불가한 환경(npm run preview, 정적 배포)에서는 실패하며,
// 이 경우 UI에서 수동 현재가 입력으로 폴백한다.

declare global {
  interface Window {
    // Electron preload가 노출하는 시세 조회 브리지
    quoteApi?: {
      fetch: (codes: string[]) => Promise<unknown>
      // 시장지수 일별(종가) 원본 텍스트 (siseJson)
      indexDaily?: (symbol: string, start: string, end: string) => Promise<string>
    }
  }
}

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
  const ex = data.stockExchangeType as { name?: unknown } | undefined
  const market = ex && typeof ex.name === 'string' ? ex.name : undefined
  return {
    code,
    price,
    name: typeof data.stockName === 'string' ? data.stockName : undefined,
    changeRate: isFinite(changeRate) ? changeRate : undefined,
    marketStatus: typeof data.marketStatus === 'string' ? data.marketStatus : undefined,
    market,
    updatedAt: new Date().toISOString(),
    manual: false,
  }
}

/** 네이버 응답 JSON(datas) → {quotes, errors} (요청한 codes 기준 누락 판정) */
function mapQuotes(
  json: unknown,
  codes: string[],
): { quotes: Quote[]; errors: { code: string; message: string }[] } {
  const datas = ((json as { datas?: unknown[] })?.datas ?? []) as Record<string, unknown>[]
  const byCode = new Map<string, Quote>()
  for (const d of datas) {
    const q = parseDatum(d)
    if (q) byCode.set(q.code, q)
  }
  const quotes: Quote[] = []
  const errors: { code: string; message: string }[] = []
  for (const code of codes) {
    const q = byCode.get(code)
    if (q) quotes.push(q)
    else errors.push({ code, message: '해당 종목 시세를 찾을 수 없습니다.' })
  }
  return { quotes, errors }
}

/**
 * 여러 종목 현재가를 한 번의 요청으로 조회(멀티-코드).
 * 성공분만 quotes에 담고, 응답에 없거나 실패한 종목은 errors에 모은다.
 */
export async function fetchQuotes(
  codes: string[],
): Promise<{ quotes: Quote[]; errors: { code: string; message: string }[] }> {
  if (codes.length === 0) return { quotes: [], errors: [] }

  const failAll = (message: string) => ({
    quotes: [] as Quote[],
    errors: codes.map((code) => ({ code, message })),
  })

  // Electron: 메인 프로세스 브리지로 직접 조회 (CORS 없음)
  if (typeof window !== 'undefined' && window.quoteApi) {
    try {
      const json = await window.quoteApi.fetch(codes)
      return mapQuotes(json, codes)
    } catch {
      return failAll('시세 조회에 실패했습니다. 잠시 후 다시 시도하세요.')
    }
  }

  // 웹: 개발 서버 프록시 경유
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}/${codes.join(',')}`, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    return failAll(
      '시세 서버에 연결할 수 없습니다. (자동 조회는 데스크톱 앱 또는 npm run dev 에서 동작합니다)',
    )
  }
  if (!res.ok) return failAll(`시세 조회 실패 (HTTP ${res.status})`)

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return failAll('시세 응답을 해석할 수 없습니다.')
  }
  return mapQuotes(json, codes)
}

/** 단일 종목 현재가 조회. 실패 시 QuoteFetchError throw. */
export async function fetchQuote(code: string): Promise<Quote> {
  const { quotes, errors } = await fetchQuotes([code])
  if (quotes[0]) return quotes[0]
  throw new QuoteFetchError(errors[0]?.message ?? '시세 조회 실패')
}
