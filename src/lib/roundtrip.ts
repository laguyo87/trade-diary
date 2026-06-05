import type { OpenPosition, RoundTrip, Trade } from '../types'

// FIFO 라운드트립 매칭.
// 같은 (계좌, 종목)에 대해 매수 lot을 시간순 큐에 쌓고, 매도 시
// 앞에서부터(FIFO) 소진하며 실현손익을 계산한다.
// 매도 1건 = 라운드트립 1건 (여러 매수 lot을 소비할 수 있음).

interface Lot {
  tradeId: string
  qty: number // 남은 수량
  price: number
}

function groupKey(t: Trade): string {
  return `${t.account ?? ''}|${t.stockCode}`
}

/** 시간 오름차순 정렬 (동시각이면 매수를 매도보다 먼저). */
function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.datetime !== b.datetime) return a.datetime < b.datetime ? -1 : 1
    if (a.side !== b.side) return a.side === 'buy' ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

export interface MatchResult {
  roundTrips: RoundTrip[]
  openPositions: OpenPosition[]
}

export function matchRoundTrips(trades: Trade[]): MatchResult {
  const groups = new Map<string, Trade[]>()
  for (const t of trades) {
    const k = groupKey(t)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(t)
  }

  const roundTrips: RoundTrip[] = []
  const openPositions: OpenPosition[] = []

  for (const [, groupTrades] of groups) {
    const sorted = sortTrades(groupTrades)
    const lots: Lot[] = []

    for (const t of sorted) {
      if (t.side === 'buy') {
        lots.push({ tradeId: t.id, qty: t.quantity, price: t.price })
        continue
      }

      // 매도 — FIFO로 매수 lot 소진
      let remaining = t.quantity
      let matchedQty = 0
      let buyCost = 0
      const buyTradeIds: string[] = []
      let openDate = t.datetime

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0]
        const take = Math.min(remaining, lot.qty)
        if (matchedQty === 0) {
          // 첫 소비 lot의 매수 시각을 openDate로 (정렬상 가장 오래된 lot)
          const firstBuy = sorted.find((s) => s.id === lot.tradeId)
          if (firstBuy) openDate = firstBuy.datetime
        }
        buyCost += take * lot.price
        matchedQty += take
        remaining -= take
        lot.qty -= take
        if (!buyTradeIds.includes(lot.tradeId)) buyTradeIds.push(lot.tradeId)
        if (lot.qty <= 0) lots.shift()
      }

      // 매칭된 수량이 없으면(매수 이력 없는 매도) 라운드트립 생성 불가 — 건너뜀
      if (matchedQty <= 0) continue

      const sellAmount = matchedQty * t.price
      const fee = t.fee ?? 0
      const pnl = sellAmount - buyCost - fee
      const avgBuyPrice = buyCost / matchedQty

      roundTrips.push({
        id: t.id,
        stockCode: t.stockCode,
        stockName: t.stockName,
        account: t.account,
        openDate,
        closeDate: t.datetime,
        quantity: matchedQty,
        avgBuyPrice,
        sellPrice: t.price,
        buyAmount: buyCost,
        sellAmount,
        fee,
        pnl,
        pnlPct: buyCost > 0 ? (pnl / buyCost) * 100 : 0,
        buyTradeIds,
        sellTradeId: t.id,
      })
    }

    // 남은 매수 lot = 미청산 포지션 (종목별 합산)
    const open = lots.filter((l) => l.qty > 0)
    if (open.length > 0) {
      const sample = sorted.find((s) => s.side === 'buy')!
      const totalQty = open.reduce((s, l) => s + l.qty, 0)
      const cost = open.reduce((s, l) => s + l.qty * l.price, 0)
      openPositions.push({
        key: groupKey(sample),
        stockCode: sample.stockCode,
        stockName: sample.stockName,
        account: sample.account,
        quantity: totalQty,
        avgBuyPrice: cost / totalQty,
        cost,
      })
    }
  }

  // 최신 청산이 위로 오도록 정렬
  roundTrips.sort((a, b) => (a.closeDate < b.closeDate ? 1 : -1))
  return { roundTrips, openPositions }
}
