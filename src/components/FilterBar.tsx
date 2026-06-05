import type { TradeFilter } from '../lib/filters'
import { emptyFilter } from '../lib/filters'

interface Props {
  filter: TradeFilter
  onChange: (f: TradeFilter) => void
  showSide?: boolean
  strategies?: string[] // 제공되면 전략 필터 노출
}

export function FilterBar({ filter, onChange, showSide = true, strategies }: Props) {
  const set = (patch: Partial<TradeFilter>) => onChange({ ...filter, ...patch })
  const dirty = JSON.stringify(filter) !== JSON.stringify(emptyFilter)

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div className="grow-0">
        <label className="label">시작일</label>
        <input
          type="date"
          className="input"
          value={filter.from}
          onChange={(e) => set({ from: e.target.value })}
        />
      </div>
      <div className="grow-0">
        <label className="label">종료일</label>
        <input
          type="date"
          className="input"
          value={filter.to}
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="label">종목 검색 (이름/코드)</label>
        <input
          className="input"
          placeholder="예: 삼성전자 / 005930"
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </div>
      {showSide && (
        <div className="grow-0">
          <label className="label">매매구분</label>
          <select
            className="input"
            value={filter.side}
            onChange={(e) => set({ side: e.target.value as TradeFilter['side'] })}
          >
            <option value="">전체</option>
            <option value="buy">매수</option>
            <option value="sell">매도</option>
          </select>
        </div>
      )}
      {strategies && (
        <div className="grow-0">
          <label className="label">전략</label>
          <select
            className="input"
            value={filter.strategy}
            onChange={(e) => set({ strategy: e.target.value })}
          >
            <option value="">전체</option>
            {strategies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
      {dirty && (
        <button className="btn-ghost" onClick={() => onChange({ ...emptyFilter })}>
          초기화
        </button>
      )}
    </div>
  )
}
