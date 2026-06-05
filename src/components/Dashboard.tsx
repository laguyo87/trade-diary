import { lazy, Suspense, useMemo, useState } from 'react'
import type { Store } from '../hooks/useStore'
import { FilterBar } from './FilterBar'
import { PositionsPanel } from './PositionsPanel'
import { emptyFilter, filterRoundTrips } from '../lib/filters'
import {
  assetTrend,
  computeStats,
  pnlByStock,
  pnlByStrategy,
  portfolioValue,
  valuePositions,
} from '../lib/stats'
import { formatSignedWon, formatWon, pnlColor } from '../lib/format'

// recharts는 무거우므로 별도 청크로 분리해 대시보드 탭을 열 때만 로드한다.
const DashboardCharts = lazy(() => import('./DashboardCharts'))

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color ?? 'text-gray-900'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

const ChartFallback = () => (
  <div className="card flex h-64 items-center justify-center text-sm text-gray-400">
    차트 불러오는 중…
  </div>
)

export function Dashboard({ store }: { store: Store }) {
  const [filter, setFilter] = useState(emptyFilter)
  const [capitalDraft, setCapitalDraft] = useState(
    store.settings.initialCapital != null ? String(store.settings.initialCapital) : '',
  )

  const rts = useMemo(
    () => filterRoundTrips(store.roundTrips, store.journals, filter),
    [store.roundTrips, store.journals, filter],
  )

  const stats = useMemo(() => computeStats(rts), [rts])
  const byStock = useMemo(() => pnlByStock(rts).slice(0, 12), [rts])
  const byStrategy = useMemo(() => pnlByStrategy(rts, store.journals), [rts, store.journals])

  // 보유 평가손익 (날짜 필터와 무관 — 현재 보유 기준)
  const pv = useMemo(
    () => portfolioValue(valuePositions(store.openPositions, store.quotes)),
    [store.openPositions, store.quotes],
  )

  // 총자산 / 손익 추이
  const trend = useMemo(
    () =>
      assetTrend(
        rts,
        pv.unrealizedPnl,
        store.openPositions.length > 0 && pv.valuedCount > 0,
        store.settings.initialCapital,
      ),
    [rts, pv.unrealizedPnl, pv.valuedCount, store.openPositions.length, store.settings.initialCapital],
  )

  const commitCapital = () => {
    const v = parseFloat(capitalDraft.replace(/[,\s원]/g, ''))
    store.updateSettings({ initialCapital: isFinite(v) && v > 0 ? v : undefined })
  }

  const fmtPayoff = (n: number) => (n === Infinity ? '∞' : n === 0 ? '-' : n.toFixed(2))

  if (store.trades.length === 0) {
    return (
      <div className="card py-20 text-center text-sm text-gray-400">
        아직 데이터가 없습니다. [가져오기] 탭에서 카카오톡 체결안내를 붙여넣거나
        <br />
        [매매 기록] 탭에서 수동으로 입력해 보세요.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">대시보드</h2>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        showSide={false}
        strategies={store.allStrategies}
      />

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="총 실현손익"
          value={formatSignedWon(stats.totalPnl)}
          sub={`청산 ${stats.count}건`}
          color={pnlColor(stats.totalPnl)}
        />
        <StatCard
          label="승률"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.winCount}승 ${stats.lossCount}패`}
        />
        <StatCard label="손익비" value={fmtPayoff(stats.payoffRatio)} sub="평균수익 ÷ 평균손실" />
        <StatCard label="프로핏 팩터" value={fmtPayoff(stats.profitFactor)} sub="총이익 ÷ 총손실" />
        <StatCard
          label="평가손익 (보유)"
          value={pv.valuedCount > 0 ? formatSignedWon(pv.unrealizedPnl) : '-'}
          sub={
            store.openPositions.length > 0
              ? `보유 ${store.openPositions.length}종목 · 원금 ${formatWon(pv.cost)}`
              : '보유 종목 없음'
          }
          color={pv.valuedCount > 0 ? pnlColor(pv.unrealizedPnl) : undefined}
        />
        <StatCard
          label="총 손익 (실현+평가)"
          value={formatSignedWon(stats.totalPnl + (pv.valuedCount > 0 ? pv.unrealizedPnl : 0))}
          sub={
            store.settings.initialCapital != null
              ? `총자산 ${formatWon(
                  store.settings.initialCapital + stats.totalPnl + pv.unrealizedPnl,
                )}`
              : '초기원금 입력 시 총자산 표시'
          }
          color={pnlColor(stats.totalPnl + (pv.valuedCount > 0 ? pv.unrealizedPnl : 0))}
        />
      </div>

      {/* 초기 투자원금 설정 */}
      <div className="card flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <label className="text-xs font-medium text-gray-600">초기 투자원금(예수금)</label>
        <input
          className="input w-40 py-1.5 text-right tabular-nums"
          inputMode="numeric"
          placeholder="예: 10,000,000"
          value={capitalDraft}
          onChange={(e) => setCapitalDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          onBlur={commitCapital}
        />
        <span className="text-[11px] text-gray-400">
          입력하면 추이 그래프가 <b>총자산(절대값)</b> 기준으로 표시됩니다. 비워두면 누적 손익 기준.
        </span>
      </div>

      {/* 차트 (lazy) */}
      <Suspense fallback={<ChartFallback />}>
        <DashboardCharts
          assetTrend={trend}
          initialCapital={store.settings.initialCapital}
          byStock={byStock}
          byStrategy={byStrategy}
        />
      </Suspense>

      {/* 보유 종목 평가손익 */}
      <PositionsPanel store={store} />
    </div>
  )
}
