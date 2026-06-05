// 한국 주식 정규장 개장 여부 판정 (KST 기준, 사용자 시간대와 무관).
// 정규장: 평일 09:00 ~ 15:30. (공휴일은 별도 캘린더가 없어 미반영 —
// 휴장일에는 시세가 갱신되지 않으므로 자동 갱신해도 값이 그대로다.)

function kstParts(d: Date): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hh = parseInt(get('hour'), 10)
  const mm = parseInt(get('minute'), 10)
  return { weekday: get('weekday'), minutes: hh * 60 + mm }
}

const OPEN = 9 * 60 // 09:00
const CLOSE = 15 * 60 + 30 // 15:30

export function isKoreanMarketOpen(d = new Date()): boolean {
  const { weekday, minutes } = kstParts(d)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  return minutes >= OPEN && minutes <= CLOSE
}

export type MarketSession = 'open' | 'closed' | 'weekend'

export function marketSession(d = new Date()): MarketSession {
  const { weekday, minutes } = kstParts(d)
  if (weekday === 'Sat' || weekday === 'Sun') return 'weekend'
  return minutes >= OPEN && minutes <= CLOSE ? 'open' : 'closed'
}

export function marketSessionLabel(d = new Date()): string {
  switch (marketSession(d)) {
    case 'open':
      return '장중'
    case 'weekend':
      return '주말 휴장'
    default:
      return '장 마감'
  }
}
