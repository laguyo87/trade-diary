import { useMemo, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { FilterBar } from './FilterBar'
import { JournalEditor } from './JournalEditor'
import { StarRating } from './StarRating'
import { emptyFilter, filterRoundTrips } from '../lib/filters'
import { formatDate, formatPct, formatSignedWon, formatWon, pnlColor } from '../lib/format'

export function Journal({ store }: { store: Store }) {
  const [filter, setFilter] = useState(emptyFilter)
  const [openId, setOpenId] = useState<string | null>(null)
  const [onlyUnwritten, setOnlyUnwritten] = useState(false)

  const rows = useMemo(() => {
    let list = filterRoundTrips(store.roundTrips, store.journals, filter)
    if (onlyUnwritten) list = list.filter((r) => !store.journals[r.id])
    return list
  }, [store.roundTrips, store.journals, filter, onlyUnwritten])

  const writtenCount = store.roundTrips.filter((r) => store.journals[r.id]).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">복기 일지</h2>
        <span className="text-sm text-gray-500">
          복기 {writtenCount} / 청산 {store.roundTrips.length}건
        </span>
      </div>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        showSide={false}
        strategies={store.allStrategies}
      />

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={onlyUnwritten}
          onChange={(e) => setOnlyUnwritten(e.target.checked)}
        />
        복기 미작성만 보기
      </label>

      {rows.length === 0 ? (
        <div className="card py-16 text-center text-sm text-gray-400">
          청산된 라운드트립이 없습니다. 매수 후 매도가 기록되면 여기에 나타납니다.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const entry = store.journals[r.id]
            const open = openId === r.id
            return (
              <div key={r.id} className="card overflow-hidden p-0">
                <button
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-gray-50"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <div className="min-w-[140px] flex-1">
                    <div className="font-semibold text-gray-900">
                      {r.stockName}{' '}
                      <span className="text-xs font-normal text-gray-400">{r.stockCode}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(r.openDate)} → {formatDate(r.closeDate)} · {r.quantity}주
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-semibold tabular-nums ${pnlColor(r.pnl)}`}>
                      {formatSignedWon(r.pnl)}
                    </div>
                    <div className={`text-xs tabular-nums ${pnlColor(r.pnl)}`}>
                      {formatPct(r.pnlPct)}
                    </div>
                  </div>

                  <div className="hidden text-right text-xs text-gray-500 sm:block">
                    <div>매수 {formatWon(r.avgBuyPrice)}</div>
                    <div>매도 {formatWon(r.sellPrice)}</div>
                  </div>

                  <div className="flex min-w-[120px] flex-col items-end gap-1">
                    {entry ? (
                      <>
                        <StarRating value={entry.rating} size="sm" />
                        <div className="flex flex-wrap justify-end gap-1">
                          {entry.strategy.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                        복기 미작성
                      </span>
                    )}
                  </div>
                  <span className="text-gray-300">{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <JournalEditor
                    roundTrip={r}
                    entry={entry}
                    strategies={store.allStrategies}
                    onSave={store.saveJournal}
                    onAddStrategy={store.addStrategy}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
