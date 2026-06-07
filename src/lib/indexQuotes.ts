// 시장지수(코스피/코스닥) 일별 종가 조회.
// 네이버 siseJson(일봉) 응답을 파싱한다. 응답은 정식 JSON이 아니라
//   [['날짜','시가','고가','저가','종가',...], ["20251024", 3893.23, ..., 3941.59, ...], ...]
// 형태라 정규식으로 날짜→종가만 추출한다.
//
// 경로: Electron은 window.quoteApi.indexDaily(IPC), 웹은 /naver-index 프록시.

const INDEX_ENDPOINT = '/naver-index'

/** "YYYY-MM-DD" 또는 "YYYY-MM-DDT..." → "YYYYMMDD" */
export function toYmd(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, '')
}

/** siseJson 텍스트 → { 'YYYYMMDD': 종가 } */
export function parseSiseJson(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  // ["20251024", 3893.23, 3951.07, 3886.64, 3941.59, ...]
  const re = /\["(\d{8})"\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const close = parseFloat(m[2])
    if (isFinite(close)) out[m[1]] = close
  }
  return out
}

/** 지수 일별 종가 시리즈 조회(start~end, YYYYMMDD). 실패 시 빈 객체. */
export async function fetchIndexSeries(
  symbol: string,
  start: string,
  end: string,
): Promise<Record<string, number>> {
  let text: string
  try {
    if (typeof window !== 'undefined' && window.quoteApi?.indexDaily) {
      text = await window.quoteApi.indexDaily(symbol, start, end)
    } else {
      const url = `${INDEX_ENDPOINT}?symbol=${encodeURIComponent(
        symbol,
      )}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`
      const res = await fetch(url, { headers: { Accept: 'text/plain' } })
      if (!res.ok) return {}
      text = await res.text()
    }
  } catch {
    return {}
  }
  return parseSiseJson(text)
}

/** ymd(YYYYMMDD) 이하에서 가장 최근 종가 (해당일 휴장 시 직전 영업일) */
export function closeOnOrBefore(
  series: Record<string, number>,
  ymd: string,
): number | undefined {
  if (series[ymd] != null) return series[ymd]
  const days = Object.keys(series)
    .filter((d) => d <= ymd)
    .sort()
  const last = days[days.length - 1]
  return last ? series[last] : undefined
}

/** 시리즈의 최신 종가 */
export function latestClose(series: Record<string, number>): { ymd: string; close: number } | undefined {
  const days = Object.keys(series).sort()
  const last = days[days.length - 1]
  return last ? { ymd: last, close: series[last] } : undefined
}

export interface RelativeStop {
  stockReturnPct: number // 종목 누적수익률
  indexReturnPct: number // 지수 누적수익률
  relativePct: number // 지수 대비 = 종목 - 지수
  reached: boolean // -10% 이하 도달
  entryYmd: string
  entryIndex: number
  currentYmd: string
  currentIndex: number
  market: string
}

export const STOP_THRESHOLD = -10 // 지수 대비 손절 기준 %

/**
 * 지수 대비 손절 기준 산출.
 * - stockReturnPct: (현재가 - 평균매수가)/평균매수가 × 100
 * - indexReturnPct: (현재 지수종가 - 매수일 지수종가)/매수일 지수종가 × 100
 * - 지수 대비 = stockReturnPct - indexReturnPct, ≤ -10% 면 손절 신호.
 * 데이터 부족 시 null.
 */
export function computeRelativeStop(args: {
  market?: string
  entryDate: string // 포지션 진입일 (ISO)
  stockReturnPct?: number
  indexCache: Record<string, Record<string, number>>
}): RelativeStop | null {
  const { market, entryDate, stockReturnPct, indexCache } = args
  if (!market || stockReturnPct == null) return null
  const series = indexCache[market]
  if (!series || Object.keys(series).length === 0) return null

  const entryYmd = toYmd(entryDate)
  const entryIndex = closeOnOrBefore(series, entryYmd)
  const latest = latestClose(series)
  if (entryIndex == null || !latest || entryIndex <= 0) return null

  const indexReturnPct = ((latest.close - entryIndex) / entryIndex) * 100
  const relativePct = stockReturnPct - indexReturnPct
  return {
    stockReturnPct,
    indexReturnPct,
    relativePct,
    reached: relativePct <= STOP_THRESHOLD,
    entryYmd,
    entryIndex,
    currentYmd: latest.ymd,
    currentIndex: latest.close,
    market,
  }
}
