import { useMemo, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { FilterBar } from './FilterBar'
import { ManualTradeForm } from './ManualTradeForm'
import { emptyFilter, filterTrades } from '../lib/filters'
import { formatDateTime, formatNumber, formatWon } from '../lib/format'

export function TradeList({ store }: { store: Store }) {
  const [filter, setFilter] = useState(emptyFilter)
  const [showForm, setShowForm] = useState(true)

  const filtered = useMemo(
    () =>
      filterTrades(store.trades, filter).sort((a, b) =>
        a.datetime < b.datetime ? 1 : -1,
      ),
    [store.trades, filter],
  )

  const totalBuy = filtered
    .filter((t) => t.side === 'buy')
    .reduce((s, t) => s + t.amount, 0)
  const totalSell = filtered
    .filter((t) => t.side === 'sell')
    .reduce((s, t) => s + t.amount, 0)

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
          <table className="w-full min-w-[760px] text-sm">
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
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                    {formatDateTime(t.datetime)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{t.stockName}</div>
                    <div className="text-xs text-gray-400">{t.stockCode}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        t.side === 'buy'
                          ? 'bg-red-50 text-profit'
                          : 'bg-blue-50 text-loss'
                      }`}
                    >
                      {t.side === 'buy' ? '매수' : '매도'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(t.quantity)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatWon(t.price)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {formatWon(t.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
                    {t.account ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-xs text-gray-400 hover:text-red-500"
                      onClick={() => {
                        if (confirm(`${t.stockName} ${t.side === 'buy' ? '매수' : '매도'} 기록을 삭제할까요?`))
                          store.deleteTrade(t.id)
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
