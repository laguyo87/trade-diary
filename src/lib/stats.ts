import type { JournalEntry, OpenPosition, Quote, RoundTrip } from '../types'

// 대시보드 지표 계산. 입력은 실현된 라운드트립 목록.

export interface Stats {
  count: number
  totalPnl: number
  totalBuyAmount: number
  winCount: number
  lossCount: number
  winRate: number // %
  avgWin: number // 평균 수익(이익 거래)
  avgLoss: number // 평균 손실(손실 거래, 양수)
  payoffRatio: number // 손익비 = avgWin / avgLoss
  profitFactor: number // 총이익 / 총손실(절댓값)
  avgPnlPct: number // 평균 수익률 %
  bestPnl: number
  worstPnl: number
}

export function computeStats(rts: RoundTrip[]): Stats {
  const count = rts.length
  const wins = rts.filter((r) => r.pnl > 0)
  const losses = rts.filter((r) => r.pnl < 0)
  const totalPnl = rts.reduce((s, r) => s + r.pnl, 0)
  const totalBuyAmount = rts.reduce((s, r) => s + r.buyAmount, 0)
  const grossProfit = wins.reduce((s, r) => s + r.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, r) => s + r.pnl, 0))
  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0

  return {
    count,
    totalPnl,
    totalBuyAmount,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: count ? (wins.length / count) * 100 : 0,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgPnlPct: count ? rts.reduce((s, r) => s + r.pnlPct, 0) / count : 0,
    bestPnl: count ? Math.max(...rts.map((r) => r.pnl)) : 0,
    worstPnl: count ? Math.min(...rts.map((r) => r.pnl)) : 0,
  }
}

export interface EquityPoint {
  date: string
  pnl: number
  cumulative: number
}

/** 청산일 순서대로 누적 손익 곡선 */
export function equityCurve(rts: RoundTrip[]): EquityPoint[] {
  const sorted = [...rts].sort((a, b) => (a.closeDate < b.closeDate ? -1 : 1))
  let cum = 0
  return sorted.map((r) => {
    cum += r.pnl
    return { date: r.closeDate.slice(0, 10), pnl: r.pnl, cumulative: Math.round(cum) }
  })
}

// ----- 총자산 / 손익 추이 -----

export interface AssetPoint {
  date: string
  realized: number // 누적 실현손익 (해당일까지)
  total?: number // 평가손익 포함 총손익 (마지막 구간 점선용)
  asset?: number // 절대 총자산 = 초기원금 + realized
  assetTotal?: number // 절대 총자산 (평가손익 포함, 마지막 구간 점선용)
  projected?: boolean // 현재가 기반 추정 점 여부
}

/**
 * 총자산/손익 추이 데이터.
 * - 과거: 청산일별 누적 실현손익.
 * - 마지막 '현재' 점: 누적 실현 + 보유 평가손익(currentUnrealized)을 더한 총손익.
 * - initialCapital 지정 시 절대 총자산(asset) 값도 함께 계산.
 */
export function assetTrend(
  rts: RoundTrip[],
  currentUnrealized: number,
  hasHoldings: boolean,
  initialCapital?: number,
): AssetPoint[] {
  const byDate = new Map<string, number>()
  for (const r of rts) {
    const d = r.closeDate.slice(0, 10)
    byDate.set(d, (byDate.get(d) ?? 0) + r.pnl)
  }
  const dates = [...byDate.keys()].sort()

  const base = initialCapital ?? 0
  let cum = 0
  const points: AssetPoint[] = dates.map((d) => {
    cum += byDate.get(d)!
    const realized = Math.round(cum)
    return {
      date: d,
      realized,
      ...(initialCapital != null ? { asset: base + realized } : {}),
    }
  })

  // 보유 종목이 있으면 '현재(평가 포함)' 점을 덧붙인다.
  if (hasHoldings) {
    const realizedNow = Math.round(cum)
    const totalNow = Math.round(cum + currentUnrealized)
    // 마지막 실현 점에서 점선이 이어지도록 시작값을 채운다.
    if (points.length > 0) {
      points[points.length - 1].total = realizedNow
      if (initialCapital != null) points[points.length - 1].assetTotal = base + realizedNow
    }
    points.push({
      date: '현재',
      realized: realizedNow,
      total: totalNow,
      ...(initialCapital != null
        ? { asset: base + totalNow, assetTotal: base + totalNow }
        : {}),
      projected: true,
    })
  }

  return points
}

export interface GroupPnl {
  name: string
  pnl: number
  count: number
}

/** 종목별 손익 */
export function pnlByStock(rts: RoundTrip[]): GroupPnl[] {
  const m = new Map<string, GroupPnl>()
  for (const r of rts) {
    const cur = m.get(r.stockCode) ?? { name: r.stockName, pnl: 0, count: 0 }
    cur.pnl += r.pnl
    cur.count += 1
    m.set(r.stockCode, cur)
  }
  return [...m.values()].sort((a, b) => b.pnl - a.pnl)
}

// ----- 보유 종목 평가손익 -----

export interface ValuedPosition extends OpenPosition {
  currentPrice?: number // 현재가 (없으면 미조회)
  changeRate?: number
  marketValue?: number // 평가금액 = 현재가 * 수량
  unrealizedPnl?: number // 평가손익 = 평가금액 - 평가원금
  unrealizedPct?: number // 평가수익률 %
  quotedAt?: string
  manualQuote?: boolean
}

export function valuePositions(
  positions: OpenPosition[],
  quotes: Record<string, Quote>,
): ValuedPosition[] {
  return positions.map((p) => {
    const q = quotes[p.stockCode]
    if (!q) return { ...p }
    const marketValue = q.price * p.quantity
    const unrealizedPnl = marketValue - p.cost
    return {
      ...p,
      currentPrice: q.price,
      changeRate: q.changeRate,
      marketValue,
      unrealizedPnl,
      unrealizedPct: p.cost > 0 ? (unrealizedPnl / p.cost) * 100 : 0,
      quotedAt: q.updatedAt,
      manualQuote: q.manual,
    }
  })
}

export interface PortfolioValue {
  cost: number // 평가원금 합
  marketValue: number // 평가금액 합 (현재가 있는 종목만)
  unrealizedPnl: number // 평가손익 합
  unrealizedPct: number
  valuedCount: number // 현재가 반영된 종목 수
  totalCount: number
}

export function portfolioValue(valued: ValuedPosition[]): PortfolioValue {
  const withPrice = valued.filter((p) => p.marketValue != null)
  const cost = valued.reduce((s, p) => s + p.cost, 0)
  const valuedCost = withPrice.reduce((s, p) => s + p.cost, 0)
  const marketValue = withPrice.reduce((s, p) => s + (p.marketValue ?? 0), 0)
  const unrealizedPnl = marketValue - valuedCost
  return {
    cost,
    marketValue,
    unrealizedPnl,
    unrealizedPct: valuedCost > 0 ? (unrealizedPnl / valuedCost) * 100 : 0,
    valuedCount: withPrice.length,
    totalCount: valued.length,
  }
}

/** 전략별 손익 (복기 메모의 strategy 태그 기준, 한 RT가 여러 태그면 각 태그에 가산) */
export function pnlByStrategy(
  rts: RoundTrip[],
  journals: Record<string, JournalEntry>,
): GroupPnl[] {
  const m = new Map<string, GroupPnl>()
  for (const r of rts) {
    const tags = journals[r.id]?.strategy ?? []
    const keys = tags.length ? tags : ['(미분류)']
    for (const k of keys) {
      const cur = m.get(k) ?? { name: k, pnl: 0, count: 0 }
      cur.pnl += r.pnl
      cur.count += 1
      m.set(k, cur)
    }
  }
  return [...m.values()].sort((a, b) => b.pnl - a.pnl)
}
