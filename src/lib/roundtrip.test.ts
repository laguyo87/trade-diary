import { describe, expect, it } from 'vitest'
import { matchRoundTrips } from './roundtrip'
import type { Trade } from '../types'

let n = 0
function mk(p: Partial<Trade>): Trade {
  n++
  const quantity = p.quantity ?? 1
  const price = p.price ?? 1000
  return {
    id: p.id ?? `t${n}`,
    datetime: p.datetime ?? `2025-01-0${n}T09:00`,
    stockName: p.stockName ?? '삼성전자',
    stockCode: p.stockCode ?? '005930',
    side: p.side ?? 'buy',
    quantity,
    price,
    amount: quantity * price,
    account: p.account,
    fee: p.fee,
  }
}

describe('matchRoundTrips (FIFO)', () => {
  it('단순 매수→매도 1쌍의 실현손익/수익률을 계산한다', () => {
    const trades = [
      mk({ id: 'b', side: 'buy', quantity: 10, price: 1000, datetime: '2025-01-01T09:00' }),
      mk({ id: 's', side: 'sell', quantity: 10, price: 1200, datetime: '2025-01-02T09:00' }),
    ]
    const { roundTrips, openPositions } = matchRoundTrips(trades)
    expect(roundTrips).toHaveLength(1)
    expect(openPositions).toHaveLength(0)
    const r = roundTrips[0]
    expect(r.quantity).toBe(10)
    expect(r.avgBuyPrice).toBe(1000)
    expect(r.pnl).toBe(2000) // (1200-1000)*10
    expect(r.pnlPct).toBeCloseTo(20)
    expect(r.id).toBe('s') // 매도 trade id
  })

  it('여러 매수 lot을 FIFO로 소비하며 가중평균 매수가를 구한다', () => {
    const trades = [
      mk({ id: 'b1', side: 'buy', quantity: 10, price: 1000, datetime: '2025-01-01T09:00' }),
      mk({ id: 'b2', side: 'buy', quantity: 10, price: 2000, datetime: '2025-01-02T09:00' }),
      mk({ id: 's', side: 'sell', quantity: 15, price: 2500, datetime: '2025-01-03T09:00' }),
    ]
    const { roundTrips, openPositions } = matchRoundTrips(trades)
    expect(roundTrips).toHaveLength(1)
    const r = roundTrips[0]
    expect(r.quantity).toBe(15)
    // 10@1000 + 5@2000 = 20000, avg = 1333.33
    expect(r.buyAmount).toBe(20000)
    expect(r.avgBuyPrice).toBeCloseTo(1333.33, 1)
    expect(r.pnl).toBe(15 * 2500 - 20000) // 37500 - 20000 = 17500
    // 미청산 5주 @2000
    expect(openPositions).toHaveLength(1)
    expect(openPositions[0].quantity).toBe(5)
    expect(openPositions[0].avgBuyPrice).toBe(2000)
  })

  it('부분 매도 후 보유 잔량을 미청산으로 남긴다', () => {
    const trades = [
      mk({ id: 'b', side: 'buy', quantity: 100, price: 500, datetime: '2025-01-01T09:00' }),
      mk({ id: 's', side: 'sell', quantity: 30, price: 600, datetime: '2025-01-02T09:00' }),
    ]
    const { roundTrips, openPositions } = matchRoundTrips(trades)
    expect(roundTrips[0].quantity).toBe(30)
    expect(openPositions[0].quantity).toBe(70)
    expect(openPositions[0].cost).toBe(70 * 500)
  })

  it('계좌가 다르면 매칭하지 않는다', () => {
    const trades = [
      mk({ id: 'b', side: 'buy', quantity: 10, price: 1000, account: 'A' }),
      mk({ id: 's', side: 'sell', quantity: 10, price: 1200, account: 'B' }),
    ]
    const { roundTrips, openPositions } = matchRoundTrips(trades)
    expect(roundTrips).toHaveLength(0) // 매수 없는 계좌의 매도는 무시
    expect(openPositions).toHaveLength(1) // A의 매수는 미청산
    expect(openPositions[0].account).toBe('A')
  })

  it('매수 이력 없는 매도는 라운드트립을 만들지 않는다', () => {
    const trades = [mk({ id: 's', side: 'sell', quantity: 10, price: 1200 })]
    const { roundTrips } = matchRoundTrips(trades)
    expect(roundTrips).toHaveLength(0)
  })

  it('수수료를 실현손익에서 차감한다', () => {
    const trades = [
      mk({ id: 'b', side: 'buy', quantity: 10, price: 1000, datetime: '2025-01-01T09:00' }),
      mk({ id: 's', side: 'sell', quantity: 10, price: 1200, datetime: '2025-01-02T09:00', fee: 500 }),
    ]
    const { roundTrips } = matchRoundTrips(trades)
    expect(roundTrips[0].pnl).toBe(2000 - 500)
  })
})
