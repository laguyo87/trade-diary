import type { StoreSnapshot, Trade } from '../types'
import { tradeSignature } from './kakaoParser'

const KEY = 'trade-diary:v1'
const VERSION = 1

export const DEFAULT_STRATEGIES = ['갭앤고', '불플래그', 'ABCD', '모멘텀']

export function emptySnapshot(): StoreSnapshot {
  return { version: VERSION, trades: [], journals: {}, customStrategies: [] }
}

export function loadSnapshot(): StoreSnapshot {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySnapshot()
    const parsed = JSON.parse(raw) as Partial<StoreSnapshot>
    return {
      version: VERSION,
      trades: parsed.trades ?? [],
      journals: parsed.journals ?? {},
      customStrategies: parsed.customStrategies ?? [],
    }
  } catch {
    return emptySnapshot()
  }
}

export function saveSnapshot(s: StoreSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 용량 초과 등은 조용히 무시 (개인용)
  }
}

/** 시그니처 기준 중복 제거하며 trades 병합. 기존 우선 유지. */
export function mergeTrades(existing: Trade[], incoming: Trade[]): {
  merged: Trade[]
  added: number
  skipped: number
} {
  const sigs = new Set(existing.map((t) => tradeSignature(t)))
  let added = 0
  let skipped = 0
  const merged = [...existing]
  for (const t of incoming) {
    const sig = tradeSignature(t)
    if (sigs.has(sig)) {
      skipped++
      continue
    }
    sigs.add(sig)
    merged.push(t)
    added++
  }
  return { merged, added, skipped }
}

// ----- JSON 백업 -----

export function exportJson(s: StoreSnapshot): string {
  return JSON.stringify(s, null, 2)
}

export function importJson(text: string): StoreSnapshot {
  const parsed = JSON.parse(text) as Partial<StoreSnapshot>
  return {
    version: VERSION,
    trades: parsed.trades ?? [],
    journals: parsed.journals ?? {},
    customStrategies: parsed.customStrategies ?? [],
  }
}

// ----- CSV (거래 내역) -----

const CSV_HEADER = [
  'id',
  'datetime',
  'stockName',
  'stockCode',
  'side',
  'quantity',
  'price',
  'amount',
  'account',
  'fee',
  'source',
  'memo',
]

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function tradesToCsv(trades: Trade[]): string {
  const rows = [CSV_HEADER.join(',')]
  for (const t of trades) {
    rows.push(
      [
        t.id,
        t.datetime,
        t.stockName,
        t.stockCode,
        t.side,
        t.quantity,
        t.price,
        t.amount,
        t.account ?? '',
        t.fee ?? '',
        t.source ?? '',
        t.memo ?? '',
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return rows.join('\n')
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export function csvToTrades(text: string): Trade[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  const idx = (name: string) => header.indexOf(name)
  const trades: Trade[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const get = (name: string) => {
      const j = idx(name)
      return j >= 0 ? cols[j] : ''
    }
    const quantity = parseFloat(get('quantity'))
    const price = parseFloat(get('price'))
    const stockCode = get('stockCode').trim()
    const side = get('side').trim() === 'sell' ? 'sell' : 'buy'
    if (!stockCode || !isFinite(quantity) || !isFinite(price)) continue
    const amountRaw = parseFloat(get('amount'))
    const feeRaw = parseFloat(get('fee'))
    trades.push({
      id: get('id').trim() || `csv-${stockCode}-${i}-${get('datetime').trim()}`,
      datetime: get('datetime').trim(),
      stockName: get('stockName').trim(),
      stockCode,
      side,
      quantity,
      price,
      amount: isFinite(amountRaw) ? amountRaw : quantity * price,
      account: get('account').trim() || undefined,
      fee: isFinite(feeRaw) ? feeRaw : undefined,
      source: (get('source').trim() as Trade['source']) || 'manual',
      memo: get('memo').trim() || undefined,
    })
  }
  return trades
}

/** 라운드트립 + 복기 CSV (분석용 내보내기) */
export function journalsToCsv(
  rows: Array<{
    closeDate: string
    stockName: string
    stockCode: string
    quantity: number
    avgBuyPrice: number
    sellPrice: number
    pnl: number
    pnlPct: number
    strategy: string
    entryReason: string
    exitReason: string
    emotion: string
    lesson: string
    rating: number | ''
  }>,
): string {
  const header = [
    '청산일',
    '종목명',
    '종목코드',
    '수량',
    '평균매수가',
    '매도가',
    '실현손익',
    '수익률%',
    '전략',
    '진입이유',
    '청산이유',
    '감정',
    '배운점',
    '별점',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.closeDate,
        r.stockName,
        r.stockCode,
        r.quantity,
        Math.round(r.avgBuyPrice),
        r.sellPrice,
        Math.round(r.pnl),
        r.pnlPct.toFixed(2),
        r.strategy,
        r.entryReason,
        r.exitReason,
        r.emotion,
        r.lesson,
        r.rating,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}

// ----- 파일 다운로드 헬퍼 (브라우저) -----

export function downloadFile(filename: string, content: string, mime = 'text/plain'): void {
  // CSV 한글 깨짐 방지용 UTF-8 BOM
  const bom = mime.includes('csv') ? '﻿' : ''
  const blob = new Blob([bom + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
