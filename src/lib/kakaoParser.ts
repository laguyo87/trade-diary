import type { Side, Trade } from '../types'

// 카카오톡 "체결안내" 메시지 파서.
// 한국투자증권 카카오톡 알림 텍스트를 통째로 붙여넣으면 체결 건만 골라
// Trade 배열로 변환한다. 체결안내가 아닌 메시지는 무시한다.

/** 한 건의 파싱 결과(원본 라인 포함 — 미리보기용) */
export interface ParsedExecution {
  trade: Trade
  raw: string
}

// 메시지의 시작 줄: "2025년 10월 24일 오전 10:41, 한국투자증권 : ..."
const HEADER_RE =
  /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})\s*,/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "오전/오후 HH:MM" 12시간제 → 24시간제 시/분 */
function to24Hour(meridiem: string, hour: number): number {
  if (meridiem === '오전') return hour === 12 ? 0 : hour
  // 오후
  return hour === 12 ? 12 : hour + 12
}

/** 헤더 줄에서 ISO local "YYYY-MM-DDTHH:mm" 추출. 실패 시 null */
function parseHeaderDateTime(line: string): string | null {
  const m = HEADER_RE.exec(line)
  if (!m) return null
  const [, y, mon, d, meridiem, h, min] = m
  const hour24 = to24Hour(meridiem, parseInt(h, 10))
  return `${y}-${pad2(parseInt(mon, 10))}-${pad2(parseInt(d, 10))}T${pad2(hour24)}:${pad2(parseInt(min, 10))}`
}

/** "*필드명:값" 형태에서 값 추출. 공백/별표 변형 허용. */
function field(chunk: string, label: string): string | null {
  // 라인 시작의 '*'는 선택, 라벨 뒤 ':' 또는 '：'(전각) 허용
  const re = new RegExp(`\\*?\\s*${label}\\s*[:：]\\s*(.+)`)
  const m = re.exec(chunk)
  return m ? m[1].trim() : null
}

/** 매매구분 문자열 → side */
function parseSide(text: string): Side | null {
  if (text.includes('매수')) return 'buy'
  if (text.includes('매도')) return 'sell'
  return null
}

/** "KODEX 200미국채혼합(284430)" → { name, code } */
function parseStock(text: string): { name: string; code: string } | null {
  const m = /^(.*?)\s*\((\d{6})\)\s*$/.exec(text.trim())
  if (!m) return null
  return { name: m[1].trim(), code: m[2] }
}

/** "212주" / "16,325원" / "16,325" → 숫자 (콤마·단위 제거) */
function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s주원]/g, '')
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return parseFloat(cleaned)
}

/**
 * 결정적 ID 생성 — 같은 체결을 다시 붙여넣어도 동일 id가 나오도록
 * 체결 시그니처를 해시한다. (중복 저장 방지의 1차 방어선)
 */
export function tradeSignature(t: {
  datetime: string
  stockCode: string
  side: Side
  quantity: number
  price: number
  account?: string
}): string {
  return [t.datetime, t.stockCode, t.side, t.quantity, t.price, t.account ?? ''].join('|')
}

function hashId(sig: string): string {
  // djb2 변형 — 결정적, 충돌 가능성 낮음(개인용 규모에서 충분)
  let h = 5381
  for (let i = 0; i < sig.length; i++) {
    h = (h * 33) ^ sig.charCodeAt(i)
  }
  return 'k' + (h >>> 0).toString(36)
}

/**
 * 텍스트 전체를 체결안내 메시지 단위로 쪼개 Trade로 변환.
 * - 체결안내가 아닌(체결수량/단가/종목명이 없는) 메시지는 건너뜀.
 * - 동일 시그니처 중복은 결과 안에서 1건으로 합침.
 */
export function parseKakaoExecutions(text: string): ParsedExecution[] {
  const lines = text.split(/\r?\n/)

  // 메시지 헤더 위치 인덱스 수집
  const headerIdx: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (HEADER_RE.test(lines[i])) headerIdx.push(i)
  }

  const out: ParsedExecution[] = []
  const seen = new Set<string>()

  for (let h = 0; h < headerIdx.length; h++) {
    const start = headerIdx[h]
    const end = h + 1 < headerIdx.length ? headerIdx[h + 1] : lines.length
    const block = lines.slice(start, end)
    const headerLine = block[0]

    // "체결안내" 표식이 없으면 체결 메시지가 아님
    if (!headerLine.includes('체결안내')) continue

    const datetime = parseHeaderDateTime(headerLine)
    if (!datetime) continue

    const chunk = block.join('\n')

    const sideRaw = field(chunk, '매매구분')
    const stockRaw = field(chunk, '종목명')
    const qtyRaw = field(chunk, '체결수량')
    const priceRaw = field(chunk, '체결단가')
    const account = field(chunk, '계좌번호') ?? undefined

    if (!sideRaw || !stockRaw || !qtyRaw || !priceRaw) continue

    const side = parseSide(sideRaw)
    const stock = parseStock(stockRaw)
    const quantity = parseNumber(qtyRaw)
    const price = parseNumber(priceRaw)

    if (!side || !stock || quantity == null || price == null) continue
    if (quantity <= 0 || price <= 0) continue

    const sig = tradeSignature({
      datetime,
      stockCode: stock.code,
      side,
      quantity,
      price,
      account,
    })
    if (seen.has(sig)) continue
    seen.add(sig)

    const trade: Trade = {
      id: hashId(sig),
      datetime,
      stockName: stock.name,
      stockCode: stock.code,
      side,
      quantity,
      price,
      amount: Math.round(quantity * price * 100) / 100,
      account,
      source: 'kakao',
    }

    out.push({ trade, raw: block.join('\n').trim() })
  }

  return out
}
