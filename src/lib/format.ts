// 숫자/금액 포맷 유틸

/** 천 단위 콤마. 소수점은 최대 maxFrac 자리까지. */
export function formatNumber(n: number, maxFrac = 2): string {
  if (!isFinite(n)) return '-'
  return n.toLocaleString('ko-KR', { maximumFractionDigits: maxFrac })
}

/** 원화: "1,234,500원" */
export function formatWon(n: number, maxFrac = 0): string {
  if (!isFinite(n)) return '-'
  return `${formatNumber(n, maxFrac)}원`
}

/** 손익 부호 포함: "+1,200원" / "-3,400원" */
export function formatSignedWon(n: number, maxFrac = 0): string {
  if (!isFinite(n)) return '-'
  const sign = n > 0 ? '+' : ''
  return `${sign}${formatNumber(n, maxFrac)}원`
}

/** 퍼센트: "+12.34%" */
export function formatPct(n: number, frac = 2): string {
  if (!isFinite(n)) return '-'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(frac)}%`
}

/**
 * 한국 증시 관습 색상 클래스.
 * 양수(이익/상승) → 빨강, 음수(손실/하락) → 파랑, 0 → 회색.
 */
export function pnlColor(n: number): string {
  if (n > 0) return 'text-profit'
  if (n < 0) return 'text-loss'
  return 'text-gray-500'
}

/** "2025-10-24T10:41" → "2025-10-24 10:41" */
export function formatDateTime(iso: string): string {
  if (!iso) return '-'
  return iso.replace('T', ' ').slice(0, 16)
}

/** "2025-10-24T10:41" → "2025-10-24" */
export function formatDate(iso: string): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}
