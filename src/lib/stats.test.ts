import { describe, expect, it } from 'vitest'
import { assetTrend } from './stats'
import type { RoundTrip } from '../types'

function rt(closeDate: string, pnl: number): RoundTrip {
  return {
    id: closeDate + pnl,
    stockCode: '000000',
    stockName: 'x',
    openDate: closeDate,
    closeDate,
    quantity: 1,
    avgBuyPrice: 0,
    sellPrice: 0,
    buyAmount: 0,
    sellAmount: 0,
    fee: 0,
    pnl,
    pnlPct: 0,
    buyTradeIds: [],
    sellTradeId: closeDate,
  }
}

describe('assetTrend', () => {
  it('청산일별로 실현손익을 누적한다', () => {
    const pts = assetTrend(
      [rt('2025-01-02', 100), rt('2025-01-01', 200), rt('2025-01-02', 50)],
      0,
      false,
    )
    expect(pts.map((p) => [p.date, p.realized])).toEqual([
      ['2025-01-01', 200],
      ['2025-01-02', 350], // 200 + 100 + 50
    ])
    // 보유 없음 → '현재' 점 없음
    expect(pts.some((p) => p.projected)).toBe(false)
  })

  it('보유가 있으면 평가손익을 더한 현재 점을 덧붙인다', () => {
    const pts = assetTrend([rt('2025-01-01', 1000)], 500, true)
    const last = pts[pts.length - 1]
    expect(last.date).toBe('현재')
    expect(last.projected).toBe(true)
    expect(last.realized).toBe(1000)
    expect(last.total).toBe(1500) // 실현 1000 + 평가 500
    // 직전 실현 점에 점선 연결용 total 시작값이 채워진다
    expect(pts[0].total).toBe(1000)
  })

  it('초기원금 지정 시 절대 총자산(asset)을 계산한다', () => {
    const pts = assetTrend([rt('2025-01-01', 1000)], 500, true, 10_000_000)
    expect(pts[0].asset).toBe(10_001_000) // 원금 + 실현
    const last = pts[pts.length - 1]
    expect(last.asset).toBe(10_001_500) // 원금 + 실현 + 평가
    expect(last.assetTotal).toBe(10_001_500)
  })

  it('거래도 보유도 없으면 빈 배열', () => {
    expect(assetTrend([], 0, false)).toEqual([])
  })
})
