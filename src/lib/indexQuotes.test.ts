import { describe, expect, it } from 'vitest'
import {
  computeRelativeStop,
  closeOnOrBefore,
  latestClose,
  parseSiseJson,
} from './indexQuotes'

const SISE = `
 [['날짜', '시가', '고가', '저가', '종가', '거래량', '외국인소진율'],
["20251022", 3827.23, 3883.68, 3794.52, 3883.68, 597216, 0.0],
["20251023", 3835.79, 3902.21, 3822.33, 3845.56, 423588, 0.0],
["20251024", 3893.23, 3951.07, 3886.64, 3941.59, 426897, 0.0]
]`

describe('parseSiseJson', () => {
  it('날짜→종가만 추출한다 (헤더 무시)', () => {
    const m = parseSiseJson(SISE)
    expect(Object.keys(m)).toHaveLength(3)
    expect(m['20251022']).toBe(3883.68)
    expect(m['20251024']).toBe(3941.59)
  })

  it('closeOnOrBefore: 휴장일이면 직전 영업일 종가', () => {
    const m = parseSiseJson(SISE)
    expect(closeOnOrBefore(m, '20251024')).toBe(3941.59)
    expect(closeOnOrBefore(m, '20251025')).toBe(3941.59) // 주말 → 직전(24일)
    expect(closeOnOrBefore(m, '20251021')).toBeUndefined() // 데이터 이전
  })

  it('latestClose: 최신 종가', () => {
    expect(latestClose(parseSiseJson(SISE))).toEqual({ ymd: '20251024', close: 3941.59 })
  })
})

describe('computeRelativeStop (지수 대비 -10% 손절)', () => {
  it('이광수 예시: 지수 -2%, 종목 -13% → 지수 대비 -11%, 손절 도달', () => {
    // 매수일 지수 2600 → 현재 2548 (-2%), 종목 10000 → 8700 (-13%)
    const stockReturnPct = ((8700 - 10000) / 10000) * 100 // -13
    const rel = computeRelativeStop({
      market: 'KOSPI',
      entryDate: '2025-01-02T10:00',
      stockReturnPct,
      indexCache: { KOSPI: { '20250102': 2600, '20250115': 2548 } },
    })
    expect(rel).not.toBeNull()
    expect(rel!.indexReturnPct).toBeCloseTo(-2, 5)
    expect(rel!.relativePct).toBeCloseTo(-11, 5)
    expect(rel!.reached).toBe(true)
  })

  it('지수가 더 빠지면(대세 하락장) 종목이 덜 빠져 손절 아님', () => {
    // 지수 -20%, 종목 -15% → 지수 대비 +5% (시장보다 선방)
    const rel = computeRelativeStop({
      market: 'KOSPI',
      entryDate: '2025-01-02',
      stockReturnPct: -15,
      indexCache: { KOSPI: { '20250102': 3000, '20250115': 2400 } }, // -20%
    })
    expect(rel!.indexReturnPct).toBeCloseTo(-20, 5)
    expect(rel!.relativePct).toBeCloseTo(5, 5)
    expect(rel!.reached).toBe(false)
  })

  it('정확히 -10%면 손절 도달(경계 포함)', () => {
    const rel = computeRelativeStop({
      market: 'KOSDAQ',
      entryDate: '2025-01-02',
      stockReturnPct: -10,
      indexCache: { KOSDAQ: { '20250102': 800, '20250115': 800 } }, // 0%
    })
    expect(rel!.relativePct).toBeCloseTo(-10, 5)
    expect(rel!.reached).toBe(true)
  })

  it('지수/시장/수익률 데이터 부족 시 null', () => {
    expect(
      computeRelativeStop({ market: undefined, entryDate: '2025-01-02', stockReturnPct: -5, indexCache: {} }),
    ).toBeNull()
    expect(
      computeRelativeStop({ market: 'KOSPI', entryDate: '2025-01-02', stockReturnPct: undefined, indexCache: { KOSPI: { '20250102': 100 } } }),
    ).toBeNull()
    expect(
      computeRelativeStop({ market: 'KOSPI', entryDate: '2025-01-02', stockReturnPct: -5, indexCache: {} }),
    ).toBeNull()
  })
})
