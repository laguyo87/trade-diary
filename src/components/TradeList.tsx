import { useMemo, useState } from 'react'
import type { Store } from '../hooks/useStore'
import type { Side, Trade } from '../types'
import { FilterBar } from './FilterBar'
import { ManualTradeForm } from './ManualTradeForm'
import { emptyFilter, filterTrades } from '../lib/filters'
import { formatDateTime, formatNumber, formatWon } from '../lib/format'

interface Draft {
  datetime: string
  stockName: string
  stockCode: string
  side: Side
  quantity: string
  price: string
  account: string
}

function toDraft(t: Trade): Draft {
  return {
    datetime: t.datetime.slice(0, 16),
    stockName: t.stockName,
    stockCode: t.stockCode,
    side: t.side,
    quantity: String(t.quantity),
    price: String(t.price),
    account: t.account ?? '',
  }
}

function TradeRow({
  trade,
  onSave,
  onDelete,
}: {
  trade: Trade
  onSave: (id: string, patch: Partial<Trade>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(trade))

  const start = () => {
    setDraft(toDraft(trade))
    setEditing(true)
  }
  const cancel = () => setEditing(false)

  const qty = parseFloat(draft.quantity)
  const prc = parseFloat(draft.price)
  const valid =
    draft.stockName.trim() !== '' &&
    /^\d{6}$/.test(draft.stockCode.trim()) &&
    isFinite(qty) &&
    qty > 0 &&
    isFinite(prc) &&
    prc > 0 &&
    draft.datetime !== ''

  const save = () => {
    if (!valid) return
    onSave(trade.id, {
      datetime: draft.datetime.slice(0, 16),
      stockName: draft.stockName.trim(),
      stockCode: draft.stockCode.trim(),
      side: draft.side,
      quantity: qty,
      price: prc,
      account: draft.account.trim() || undefined,
    })
    setEditing(false)
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  if (!editing) {
    return (
      <tr className="border-b border-gray-50 hover:bg-gray-50">
        <td className="whitespace-nowrap px-4 py-2 text-gray-600">
          {formatDateTime(trade.datetime)}
        </td>
        <td className="px-4 py-2">
          <div className="font-medium text-gray-900">{trade.stockName}</div>
          <div className="text-xs text-gray-400">{trade.stockCode}</div>
        </td>
        <td className="px-4 py-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
              trade.side === 'buy' ? 'bg-red-50 text-profit' : 'bg-blue-50 text-loss'
            }`}
          >
            {trade.side === 'buy' ? '매수' : '매도'}
          </span>
        </td>
        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(trade.quantity)}</td>
        <td className="px-4 py-2 text-right tabular-nums">{formatWon(trade.price)}</td>
        <td className="px-4 py-2 text-right font-medium tabular-nums">{formatWon(trade.amount)}</td>
        <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
          {trade.account ?? '-'}
        </td>
        <td className="whitespace-nowrap px-4 py-2 text-right">
          <button className="text-xs text-gray-500 hover:text-gray-900" onClick={start}>
            수정
          </button>
          <span className="px-1 text-gray-300">·</span>
          <button
            className="text-xs text-gray-400 hover:text-red-500"
            onClick={() => {
              if (
                confirm(
                  `${trade.stockName} ${trade.side === 'buy' ? '매수' : '매도'} 기록을 삭제할까요?`,
                )
              )
                onDelete(trade.id)
            }}
          >
            삭제
          </button>
        </td>
      </tr>
    )
  }

  // 편집 모드
  const amount = isFinite(qty) && isFinite(prc) ? qty * prc : 0
  return (
    <tr className="border-b border-gray-100 bg-amber-50/40">
      <td className="px-2 py-1.5">
        <input
          type="datetime-local"
          className="input py-1 text-xs"
          value={draft.datetime}
          onChange={(e) => set({ datetime: e.target.value })}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          className="input mb-1 py-1 text-xs"
          placeholder="종목명"
          value={draft.stockName}
          onChange={(e) => set({ stockName: e.target.value })}
        />
        <input
          className="input py-1 text-xs"
          placeholder="005930"
          inputMode="numeric"
          maxLength={6}
          value={draft.stockCode}
          onChange={(e) => set({ stockCode: e.target.value.replace(/\D/g, '') })}
        />
      </td>
      <td className="px-2 py-1.5">
        <select
          className="input py-1 text-xs"
          value={draft.side}
          onChange={(e) => set({ side: e.target.value as Side })}
        >
          <option value="buy">매수</option>
          <option value="sell">매도</option>
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          className="input py-1 text-right text-xs tabular-nums"
          inputMode="numeric"
          value={draft.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          className="input py-1 text-right text-xs tabular-nums"
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => set({ price: e.target.value })}
        />
      </td>
      <td className="px-4 py-1.5 text-right text-xs text-gray-500 tabular-nums">
        {formatWon(amount)}
      </td>
      <td className="px-2 py-1.5">
        <input
          className="input py-1 text-xs"
          placeholder="계좌(선택)"
          value={draft.account}
          onChange={(e) => set({ account: e.target.value })}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <button
          className="text-xs font-medium text-gray-900 hover:underline disabled:text-gray-300"
          disabled={!valid}
          onClick={save}
        >
          저장
        </button>
        <span className="px-1 text-gray-300">·</span>
        <button className="text-xs text-gray-500 hover:text-gray-900" onClick={cancel}>
          취소
        </button>
      </td>
    </tr>
  )
}

export function TradeList({ store }: { store: Store }) {
  const [filter, setFilter] = useState(emptyFilter)
  const [showForm, setShowForm] = useState(true)

  const filtered = useMemo(
    () => filterTrades(store.trades, filter).sort((a, b) => (a.datetime < b.datetime ? 1 : -1)),
    [store.trades, filter],
  )

  const totalBuy = filtered.filter((t) => t.side === 'buy').reduce((s, t) => s + t.amount, 0)
  const totalSell = filtered.filter((t) => t.side === 'sell').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">매매 기록</h2>
        <button className="btn-ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '입력 폼 닫기' : '+ 수동 입력'}
        </button>
      </div>

      {showForm && <ManualTradeForm onAdd={store.addTrade} />}

      <FilterBar filter={filter} onChange={setFilter} />

      <div className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
          <span>
            {filtered.length}건 / 전체 {store.trades.length}건
          </span>
          <span>
            매수 {formatWon(totalBuy)} · 매도 {formatWon(totalSell)}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-gray-400">
            기록이 없습니다. 수동 입력 또는 [가져오기] 탭에서 카카오톡 체결안내를 붙여넣으세요.
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">일시</th>
                <th className="px-4 py-2 font-medium">종목</th>
                <th className="px-4 py-2 font-medium">구분</th>
                <th className="px-4 py-2 text-right font-medium">수량</th>
                <th className="px-4 py-2 text-right font-medium">단가</th>
                <th className="px-4 py-2 text-right font-medium">거래금액</th>
                <th className="px-4 py-2 font-medium">계좌</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TradeRow
                  key={t.id}
                  trade={t}
                  onSave={store.updateTrade}
                  onDelete={store.deleteTrade}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
