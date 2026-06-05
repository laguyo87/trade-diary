import { useMemo, useRef, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { parseKakaoExecutions } from '../lib/kakaoParser'
import {
  csvToTrades,
  downloadFile,
  exportJson,
  importJson,
  journalsToCsv,
  tradesToCsv,
} from '../lib/storage'
import { formatDateTime, formatNumber, formatWon } from '../lib/format'

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

export function ImportPanel({ store }: { store: Store }) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseKakaoExecutions(text), [text])

  const confirmImport = () => {
    if (parsed.length === 0) return
    const { added, skipped } = store.addTrades(parsed.map((p) => p.trade))
    setMsg(`${added}건 추가, ${skipped}건 중복 제외`)
    setText('')
  }

  const onJsonFile = async (file: File) => {
    try {
      const snap = importJson(await file.text())
      if (
        confirm(
          `JSON 백업을 불러오면 현재 데이터를 덮어씁니다.\n거래 ${snap.trades.length}건, 복기 ${
            Object.keys(snap.journals).length
          }건. 계속할까요?`,
        )
      ) {
        store.replaceSnapshot(snap)
        setMsg('JSON 백업을 불러왔습니다.')
      }
    } catch {
      setMsg('JSON 파일을 읽을 수 없습니다.')
    }
  }

  const onCsvFile = async (file: File) => {
    try {
      const trades = csvToTrades(await file.text())
      const { added, skipped } = store.addTrades(trades)
      setMsg(`CSV에서 ${added}건 추가, ${skipped}건 중복 제외`)
    } catch {
      setMsg('CSV 파일을 읽을 수 없습니다.')
    }
  }

  const exportTradesCsv = () =>
    downloadFile(`trades-${today()}.csv`, tradesToCsv(store.trades), 'text/csv')

  const exportJournalsCsv = () => {
    const rows = store.roundTrips.map((r) => {
      const j = store.journals[r.id]
      return {
        closeDate: r.closeDate,
        stockName: r.stockName,
        stockCode: r.stockCode,
        quantity: r.quantity,
        avgBuyPrice: r.avgBuyPrice,
        sellPrice: r.sellPrice,
        pnl: r.pnl,
        pnlPct: r.pnlPct,
        strategy: j?.strategy.join('; ') ?? '',
        entryReason: j?.entryReason ?? '',
        exitReason: j?.exitReason ?? '',
        emotion: j?.emotion ?? '',
        lesson: j?.lesson ?? '',
        rating: j?.rating ?? ('' as const),
      }
    })
    downloadFile(`journal-${today()}.csv`, journalsToCsv(rows), 'text/csv')
  }

  const exportBackup = () =>
    downloadFile(`trade-diary-backup-${today()}.json`, exportJson(store.snapshot), 'application/json')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">가져오기 / 내보내기</h2>

      {msg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* 카카오톡 파서 */}
      <div className="card space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">카카오톡 체결안내 붙여넣기</h3>
          <p className="mt-1 text-xs text-gray-500">
            한국투자증권 카카오톡 알림을 통째로 복사해 붙여넣으세요. 체결안내만 자동 인식하며,
            이미 저장된 체결은 중복으로 추가되지 않습니다.
          </p>
        </div>
        <textarea
          className="input h-44 font-mono text-xs"
          placeholder={`예)\n2025년 10월 24일 오전 10:41, 한국투자증권 : [한국투자증권 체결안내]10:41\n*계좌번호:64****22-29\n*매매구분:현금매수체결\n*종목명:KODEX 200미국채혼합(284430)\n*체결수량:212주\n*체결단가:16,325원`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            인식된 체결: <span className="font-semibold text-gray-900">{parsed.length}</span>건
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={!text} onClick={() => setText('')}>
              지우기
            </button>
            <button className="btn-primary" disabled={parsed.length === 0} onClick={confirmImport}>
              {parsed.length}건 기록에 추가
            </button>
          </div>
        </div>

        {parsed.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-1.5 font-medium">일시</th>
                  <th className="px-3 py-1.5 font-medium">종목</th>
                  <th className="px-3 py-1.5 font-medium">구분</th>
                  <th className="px-3 py-1.5 text-right font-medium">수량</th>
                  <th className="px-3 py-1.5 text-right font-medium">단가</th>
                  <th className="px-3 py-1.5 text-right font-medium">금액</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.trade.id} className="border-b border-gray-50">
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-600">
                      {formatDateTime(p.trade.datetime)}
                    </td>
                    <td className="px-3 py-1.5">
                      {p.trade.stockName}
                      <span className="text-gray-400"> ({p.trade.stockCode})</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={p.trade.side === 'buy' ? 'text-profit' : 'text-loss'}>
                        {p.trade.side === 'buy' ? '매수' : '매도'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatNumber(p.trade.quantity)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatWon(p.trade.price)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatWon(p.trade.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 백업 / 복원 */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">내보내기 (백업)</h3>
          <p className="text-xs text-gray-500">
            기기 이전·백업용. JSON은 거래+복기 전체, CSV는 표 형태로 저장됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={exportBackup}>
              전체 JSON 백업
            </button>
            <button className="btn-ghost" onClick={exportTradesCsv}>
              거래 CSV
            </button>
            <button className="btn-ghost" onClick={exportJournalsCsv}>
              복기 CSV
            </button>
          </div>
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">가져오기 (복원)</h3>
          <p className="text-xs text-gray-500">
            JSON 백업은 전체를 덮어쓰고, CSV는 거래에 병합(중복 자동 제외)합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              JSON 복원
            </button>
            <button className="btn-ghost" onClick={() => csvRef.current?.click()}>
              CSV 거래 가져오기
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onJsonFile(f)
              e.target.value = ''
            }}
          />
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onCsvFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* 전체 삭제 */}
      <div className="card flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">데이터 초기화</h3>
          <p className="text-xs text-gray-500">모든 거래와 복기 메모를 삭제합니다. 되돌릴 수 없습니다.</p>
        </div>
        <button
          className="btn-danger"
          onClick={() => {
            if (confirm('정말 모든 데이터를 삭제할까요? 되돌릴 수 없습니다.')) {
              store.clearAll()
              setMsg('모든 데이터를 삭제했습니다.')
            }
          }}
        >
          전체 삭제
        </button>
      </div>
    </div>
  )
}
