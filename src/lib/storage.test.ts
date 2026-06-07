import { describe, expect, it } from 'vitest'
import { mergeTrades } from './storage'
import { parseKakaoExecutions } from './kakaoParser'
import type { Trade } from '../types'

const SELL = `2026년 2월 20일 오전 10:14, 한국투자증권 : [한국투자증권 체결안내]10:14
*계좌번호:64****22-29
*매매구분:현금매도체결
*종목명:KODEX 미국S&P500(379800)
*체결수량:1주
*체결단가:22,580원`

describe('mergeTrades (id 기준 중복 제거)', () => {
  it('같은 id는 추가하지 않는다', () => {
    const a: Trade = {
      id: 'x1', datetime: '2025-01-01T09:00', stockName: '삼성전자', stockCode: '005930',
      side: 'buy', quantity: 1, price: 1000, amount: 1000,
    }
    const r = mergeTrades([a], [a])
    expect(r.added).toBe(0)
    expect(r.skipped).toBe(1)
    expect(r.merged).toHaveLength(1)
  })

  it('같은 분·수량·단가의 분할체결(다른 순번 id)은 각각 추가된다', () => {
    // 동일 체결 3번 = 분할체결 3건
    const blob = [SELL, SELL, SELL].join('\n\n')
    const parsed = parseKakaoExecutions(blob).map((p) => p.trade)
    expect(parsed).toHaveLength(3)
    const r = mergeTrades([], parsed)
    expect(r.added).toBe(3) // 시그니처 같아도 순번 id가 달라 3건 모두 저장
    expect(r.merged).toHaveLength(3)
  })

  it('같은 텍스트를 다시 가져오면 0건 추가(멱등)', () => {
    const blob = [SELL, SELL, SELL].join('\n\n')
    const first = mergeTrades([], parseKakaoExecutions(blob).map((p) => p.trade))
    const second = mergeTrades(first.merged, parseKakaoExecutions(blob).map((p) => p.trade))
    expect(second.added).toBe(0)
    expect(second.merged).toHaveLength(3)
  })
})
