import type { Side, Trade } from '../types'

// 카카오톡 "체결안내" 메시지 파서.
// 한국투자증권 카카오톡 알림 텍스트를 통째로 붙여넣으면 체결 건만 골라
// Trade 배열로 변환한다. 체결안내가 아닌 메시지는 무시한다.
//
// 지원하는 붙여넣기 형식(모두 자동 인식):
//   A) 대화 내보내기(.txt) — 날짜+시각이 한 줄:
//      "2025년 10월 24일 오전 10:41, 한국투자증권 : [한국투자증권 체결안내]10:41"
//      (모바일 내보내기의 "2025. 10. 24." 점 표기도 지원)
//   B) 앱에서 여러 메시지 복사 — 보낸사람/시각 헤더가 별도 줄:
//      "[한국투자증권] [오전 10:41]"  다음 줄  "[한국투자증권 체결안내]10:41"
//   C) 단일 메시지 복사 — 본문만: "[한국투자증권 체결안내]10:41" + 필드들
// 공통 기준점은 "체결안내" 마커 줄이며, 시각은 마커의 24시간 표기나
// 오전/오후 헤더에서, 날짜는 가장 가까운 날짜 구분선에서(없으면 오늘) 얻는다.

/** 한 건의 파싱 결과(원본 라인 포함 — 미리보기용) */
export interface ParsedExecution {
  trade: Trade
  raw: string
}

const ANCHOR = '체결안내'

// 날짜+오전/오후 시각이 함께 있는 줄(형식 A). "년월일" 및 "2025. 10. 24." 모두 허용.
const FULL_DT_RE =
  /(\d{4})\s*[년.]\s*(\d{1,2})\s*[월.]\s*(\d{1,2})\s*일?\s*[.,]?\s*(오전|오후)\s*(\d{1,2}):(\d{2})/
// 날짜만(구분선/헤더에서 현재 날짜 추적용)
const DATE_RE = /(\d{4})\s*[년.]\s*(\d{1,2})\s*[월.]\s*(\d{1,2})\s*일?/
// 오전/오후 시각(형식 B의 "[한국투자증권] [오전 10:41]" 등)
const AMPM_RE = /(오전|오후)\s*(\d{1,2}):(\d{2})/
// "[...체결안내]10:41" 의 24시간 시각
const MARKER_TIME_RE = /체결안내\s*\]\s*(\d{1,2}):(\d{2})/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "오전/오후 HH:MM" 12시간제 → 24시간 시 */
function to24Hour(meridiem: string, hour: number): number {
  if (meridiem === '오전') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "*필드명:값" 형태에서 값 추출. 공백/별표 변형 허용. */
function field(chunk: string, label: string): string | null {
  const re = new RegExp(`\\*?\\s*${label}\\s*[:：]\\s*(.+)`)
  const m = re.exec(chunk)
  return m ? m[1].trim() : null
}

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

/** 체결 시그니처 — 같은 체결을 다시 붙여넣어도 동일 id가 나오도록 한다. */
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
  let h = 5381
  for (let i = 0; i < sig.length; i++) h = (h * 33) ^ sig.charCodeAt(i)
  return 'k' + (h >>> 0).toString(36)
}

/** 앵커 줄(및 주변)에서 datetime(YYYY-MM-DDTHH:mm) 추출 */
function resolveDateTime(
  lines: string[],
  anchorIdx: number,
  dateAtLine: (string | null)[],
): string {
  const anchorLine = lines[anchorIdx]
  let datePart: string | null = null
  let hh: number | null = null
  let mm = 0

  // 1) 날짜+시각이 한 줄에 있는 형식 A
  const full = FULL_DT_RE.exec(anchorLine)
  if (full) {
    datePart = `${full[1]}-${pad2(parseInt(full[2], 10))}-${pad2(parseInt(full[3], 10))}`
    hh = to24Hour(full[4], parseInt(full[5], 10))
    mm = parseInt(full[6], 10)
  } else {
    // 2) 오전/오후 시각 — 앵커 줄 또는 바로 윗줄(형식 B 보낸사람 헤더)
    const am =
      AMPM_RE.exec(anchorLine) || (anchorIdx > 0 ? AMPM_RE.exec(lines[anchorIdx - 1]) : null)
    if (am) {
      hh = to24Hour(am[1], parseInt(am[2], 10))
      mm = parseInt(am[3], 10)
    } else {
      // 3) "[...체결안내]HH:MM" 24시간 표기
      const mk = MARKER_TIME_RE.exec(anchorLine)
      if (mk) {
        hh = parseInt(mk[1], 10)
        mm = parseInt(mk[2], 10)
      }
    }
  }

  if (datePart == null) datePart = dateAtLine[anchorIdx] ?? todayIso()
  const time = hh != null ? `${pad2(hh)}:${pad2(mm)}` : '00:00'
  return `${datePart}T${time}`
}

/**
 * 텍스트 전체를 체결안내 메시지 단위로 쪼개 Trade로 변환.
 * 동일 시그니처 중복은 결과 안에서 1건으로 합친다.
 */
export function parseKakaoExecutions(text: string): ParsedExecution[] {
  const lines = text.split(/\r?\n/)

  // 줄별 "현재 날짜"(가장 최근 본 날짜) — 날짜 없는 형식의 보강용
  const dateAtLine: (string | null)[] = new Array(lines.length)
  let curDate: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const m = DATE_RE.exec(lines[i])
    if (m) {
      curDate = `${m[1]}-${pad2(parseInt(m[2], 10))}-${pad2(parseInt(m[3], 10))}`
    }
    dateAtLine[i] = curDate
  }

  // "체결안내"가 포함된 줄이 각 체결 메시지의 기준점
  const anchors: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(ANCHOR)) anchors.push(i)
  }

  const out: ParsedExecution[] = []
  const seen = new Set<string>()

  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a]
    const end = a + 1 < anchors.length ? anchors[a + 1] : lines.length
    const block = lines.slice(start, end)
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

    const datetime = resolveDateTime(lines, start, dateAtLine)

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

    out.push({
      trade: {
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
      },
      raw: chunk.trim(),
    })
  }

  return out
}
