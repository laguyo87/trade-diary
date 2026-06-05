import type { JournalEntry, RoundTrip, Side, Trade } from '../types'

export interface TradeFilter {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  query: string // 종목명/코드
  side: '' | Side
  strategy: string // '' = 전체
}

export const emptyFilter: TradeFilter = {
  from: '',
  to: '',
  query: '',
  side: '',
  strategy: '',
}

function matchQuery(name: string, code: string, q: string): boolean {
  if (!q) return true
  const t = q.trim().toLowerCase()
  return name.toLowerCase().includes(t) || code.includes(t)
}

function inPeriod(date: string, from: string, to: string): boolean {
  const d = date.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export function filterTrades(trades: Trade[], f: TradeFilter): Trade[] {
  return trades.filter(
    (t) =>
      inPeriod(t.datetime, f.from, f.to) &&
      matchQuery(t.stockName, t.stockCode, f.query) &&
      (f.side === '' || t.side === f.side),
  )
}

export function filterRoundTrips(
  rts: RoundTrip[],
  journals: Record<string, JournalEntry>,
  f: TradeFilter,
): RoundTrip[] {
  return rts.filter((r) => {
    if (!inPeriod(r.closeDate, f.from, f.to)) return false
    if (!matchQuery(r.stockName, r.stockCode, f.query)) return false
    if (f.side === 'buy') return false // 라운드트립은 매도 청산 기준
    if (f.strategy) {
      const tags = journals[r.id]?.strategy ?? []
      if (!tags.includes(f.strategy)) return false
    }
    return true
  })
}
