import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Store } from '../hooks/useStore'
import { FilterBar } from './FilterBar'
import { emptyFilter, filterRoundTrips } from '../lib/filters'
import {
  computeStats,
  equityCurve,
  pnlByStock,
  pnlByStrategy,
} from '../lib/stats'
import {
  formatNumber,
  formatPct,
  formatSignedWon,
  formatWon,
  pnlColor,
} from '../lib/format'

const PROFIT = '#e03131'
const LOSS = '#1971c2'

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

function wonTooltip(v: number | string) {
  return formatSignedWon(Number(v))
}

export function Dashboard({ store }: { store: Store }) {
  const [filter, setFilter] = useState(emptyFilter)

  const rts = useMemo(
    () => filterRoundTrips(store.roundTrips, store.journals, filter),
    [store.roundTrips, store.journals, filter],
  )

  const stats = useMemo(() => computeStats(rts), [rts])
  const curve = useMemo(() => equityCurve(rts), [rts])
  const byStock = useMemo(() => pnlByStock(rts).slice(0, 12), [rts])
  const byStrategy = useMemo(
    () => pnlByStrategy(rts, store.journals),
    [rts, store.journals],
  )

  const openCost = store.openPositions.reduce((s, p) => s + p.cost, 0)

  const fmtPayoff = (n: number) =>
    n === Infinity ? '∞' : n === 0 ? '-' : n.toFixed(2)

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
        <StatCard
          label="손익비"
          value={fmtPayoff(stats.payoffRatio)}
          sub="평균수익 ÷ 평균손실"
        />
        <StatCard
          label="프로핏 팩터"
          value={fmtPayoff(stats.profitFactor)}
          sub="총이익 ÷ 총손실"
        />
        <StatCard
          label="평균 수익률"
          value={formatPct(stats.avgPnlPct)}
          color={pnlColor(stats.avgPnlPct)}
        />
        <StatCard
          label="보유 평가원금"
          value={formatWon(openCost)}
          sub={`미청산 ${store.openPositions.length}종목`}
        />
      </div>

      {/* 누적 손익 곡선 */}
      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">누적 손익 곡선</h3>
        {curve.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">청산된 거래가 없습니다.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curve} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <Tooltip
                formatter={(v: number) => [wonTooltip(v), '누적손익']}
                labelFormatter={(l) => `청산일 ${l}`}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#111827"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 종목별 손익 */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">종목별 손익</h3>
          {byStock.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, byStock.length * 30)}>
              <BarChart
                data={byStock}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatNumber(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v: number) => [wonTooltip(v), '손익']} />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                  {byStock.map((d) => (
                    <Cell key={d.name} fill={d.pnl >= 0 ? PROFIT : LOSS} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 전략별 손익 */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">전략별 손익</h3>
          {byStrategy.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              복기 일지에 전략 태그를 남기면 집계됩니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, byStrategy.length * 36)}>
              <BarChart
                data={byStrategy}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatNumber(Number(v))}
                />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, _n, p) => [
                    wonTooltip(v),
                    `손익 (${p.payload.count}건)`,
                  ]}
                />
                <ReferenceLine x={0} stroke="#cbd5e1" />
                <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                  {byStrategy.map((d) => (
                    <Cell key={d.name} fill={d.pnl >= 0 ? PROFIT : LOSS} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 미청산 포지션 */}
      {store.openPositions.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <h3 className="px-4 pt-4 text-sm font-semibold text-gray-800">미청산(보유) 포지션</h3>
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">종목</th>
                <th className="px-4 py-2 text-right font-medium">보유수량</th>
                <th className="px-4 py-2 text-right font-medium">평균매수가</th>
                <th className="px-4 py-2 text-right font-medium">평가원금</th>
                <th className="px-4 py-2 font-medium">계좌</th>
              </tr>
            </thead>
            <tbody>
              {store.openPositions.map((p) => (
                <tr key={p.key} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    {p.stockName}{' '}
                    <span className="text-xs text-gray-400">{p.stockCode}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(p.quantity)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatWon(p.avgBuyPrice)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatWon(p.cost)}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{p.account ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
