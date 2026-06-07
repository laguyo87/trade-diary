import { describe, expect, it } from 'vitest'
import { parseKakaoExecutions, tradeSignature } from './kakaoParser'

// 사용자 제공 샘플 (한국투자증권 카카오톡 체결안내)
const SAMPLE_BUY = `2025년 10월 24일 오전 10:41, 한국투자증권 : [한국투자증권 체결안내]10:41
*계좌번호:64****22-29
*계좌명:김신회
*매매구분:현금매수체결
*종목명:KODEX 200미국채혼합(284430)
*체결수량:212주
*체결단가:16,325원`

const SAMPLE_SELL = `2025년 10월 24일 오후 1:05, 한국투자증권 : [한국투자증권 체결안내]13:05

*계좌번호:43****95-01
*계좌명:김신회
*매매구분:현금매도체결
*종목명:ACE KRX금현물(411060)
*체결수량:3주
*체결단가:26,655원

*주문수량:3주
*총체결수량:3주`

// 체결안내가 아닌 일반 메시지
const NOISE = `2025년 1월 16일 오전 9:43, 한국투자증권 : 제목: 오픈뱅킹 출금이체 동의 안내
[한국투자]
김신회고객님
* 출금계좌: 한국투자 64****22-21`

describe('parseKakaoExecutions', () => {
  it('매수 체결 한 건을 정확히 파싱한다', () => {
    const res = parseKakaoExecutions(SAMPLE_BUY)
    expect(res).toHaveLength(1)
    const t = res[0].trade
    expect(t.datetime).toBe('2025-10-24T10:41')
    expect(t.side).toBe('buy')
    expect(t.stockName).toBe('KODEX 200미국채혼합')
    expect(t.stockCode).toBe('284430')
    expect(t.quantity).toBe(212)
    expect(t.price).toBe(16325)
    expect(t.amount).toBe(212 * 16325)
    expect(t.account).toBe('64****22-29')
    expect(t.source).toBe('kakao')
  })

  it('오후 시각을 24시간제로 변환하고 매도/추가필드를 처리한다', () => {
    const res = parseKakaoExecutions(SAMPLE_SELL)
    expect(res).toHaveLength(1)
    const t = res[0].trade
    expect(t.datetime).toBe('2025-10-24T13:05') // 오후 1:05 → 13:05
    expect(t.side).toBe('sell')
    expect(t.stockName).toBe('ACE KRX금현물')
    expect(t.stockCode).toBe('411060')
    expect(t.quantity).toBe(3)
    expect(t.price).toBe(26655)
    expect(t.account).toBe('43****95-01')
  })

  it('오전 12시는 0시, 오후 12시는 12시로 변환한다', () => {
    const midnight = parseKakaoExecutions(
      SAMPLE_BUY.replace('오전 10:41', '오전 12:03'),
    )
    expect(midnight[0].trade.datetime).toBe('2025-10-24T00:03')
    const noon = parseKakaoExecutions(SAMPLE_BUY.replace('오전 10:41', '오후 12:30'))
    expect(noon[0].trade.datetime).toBe('2025-10-24T12:30')
  })

  it('여러 건을 한 번에 인식하고 체결안내가 아닌 메시지는 무시한다', () => {
    const blob = [SAMPLE_BUY, NOISE, SAMPLE_SELL].join('\n\n')
    const res = parseKakaoExecutions(blob)
    expect(res).toHaveLength(2)
    expect(res.map((r) => r.trade.side).sort()).toEqual(['buy', 'sell'])
  })

  it('같은 분·수량·단가의 분할체결은 각각 보존하고 서로 다른 id를 부여한다', () => {
    // 같은 텍스트에 동일 체결이 2번(분할체결) → 2건 보존, id 다름
    const blob = [SAMPLE_BUY, SAMPLE_BUY].join('\n\n')
    const res = parseKakaoExecutions(blob)
    expect(res).toHaveLength(2)
    // 시그니처는 같지만 발생 순번이 달라 id가 서로 다르다
    expect(res[0].trade.id).not.toBe(res[1].trade.id)
    // 두 건의 핵심 값(수량·단가·시각)은 동일
    expect(res[0].trade.quantity).toBe(res[1].trade.quantity)
    expect(res[0].trade.datetime).toBe(res[1].trade.datetime)
  })

  it('같은 텍스트를 다시 파싱하면 동일한 id 집합을 생성한다(재import 멱등성)', () => {
    const blob = [SAMPLE_BUY, SAMPLE_BUY, SAMPLE_SELL].join('\n\n')
    const a = parseKakaoExecutions(blob).map((r) => r.trade.id)
    const b = parseKakaoExecutions(blob).map((r) => r.trade.id)
    expect(a).toEqual(b)
  })

  it('체결안내가 전혀 없으면 빈 배열', () => {
    expect(parseKakaoExecutions(NOISE)).toEqual([])
    expect(parseKakaoExecutions('')).toEqual([])
  })

  it('형식 B: 앱에서 복사한 "[보낸사람] [오전 H:MM]" 헤더 + 본문을 인식한다', () => {
    const appCopy = `2025년 10월 24일
[한국투자증권] [오전 10:41]
[한국투자증권 체결안내]10:41
*계좌번호:64****22-01
*계좌명:김신회
*매매구분:현금매수체결
*종목명:삼성전자(005930)
*체결수량:1주
*체결단가:331,000원

*주문수량:1주
*총체결수량:1주
*주문번호:49641000`
    const res = parseKakaoExecutions(appCopy)
    expect(res).toHaveLength(1)
    const t = res[0].trade
    expect(t.datetime).toBe('2025-10-24T10:41')
    expect(t.side).toBe('buy')
    expect(t.stockCode).toBe('005930')
    expect(t.quantity).toBe(1)
    expect(t.price).toBe(331000)
  })

  it('형식 C: 날짜 헤더 없는 단일 본문도 인식한다(시각은 마커, 날짜는 오늘)', () => {
    const body = `[한국투자증권 체결안내]13:05
*계좌번호:64****22-01
*매매구분:현금매도체결
*종목명:삼성전자(005930)
*체결수량:2주
*체결단가:332,500원`
    const res = parseKakaoExecutions(body)
    expect(res).toHaveLength(1)
    const t = res[0].trade
    expect(t.side).toBe('sell')
    expect(t.quantity).toBe(2)
    expect(t.price).toBe(332500)
    // 시각은 마커(24시간)에서 추출, 날짜는 오늘로 보강
    expect(t.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T13:05$/)
  })

  it('모바일 내보내기의 점 표기 날짜(2025. 10. 24.)도 인식한다', () => {
    const dotted = SAMPLE_BUY.replace('2025년 10월 24일', '2025. 10. 24.')
    const res = parseKakaoExecutions(dotted)
    expect(res).toHaveLength(1)
    expect(res[0].trade.datetime).toBe('2025-10-24T10:41')
  })

  it('tradeSignature는 핵심 필드로 구성된다', () => {
    const sig = tradeSignature({
      datetime: '2025-10-24T10:41',
      stockCode: '284430',
      side: 'buy',
      quantity: 212,
      price: 16325,
      account: '64****22-29',
    })
    expect(sig).toBe('2025-10-24T10:41|284430|buy|212|16325|64****22-29')
  })
})
