import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AssetPoint, GroupPnl } from '../lib/stats'
import { formatNumber, formatSignedWon, formatWon } from '../lib/format'

// recharts를 사용하는 부분만 분리한 컴포넌트.
// Dashboard에서 React.lazy로 동적 import 하므로 recharts는 별도 청크로
// 분리되어 대시보드 탭을 열 때만 로드된다.

const PROFIT = '#e03131'
const LOSS = '#1971c2'

const won = (v: number | string) => formatSignedWon(Number(v))

interface Props {
  assetTrend: AssetPoint[]
  initialCapital?: number
  byStock: GroupPnl[]
  byStrategy: GroupPnl[]
}

export default function DashboardCharts({
  assetTrend,
  initialCapital,
  byStock,
  byStrategy,
}: Props) {
  const absolute = initialCapital != null
  const mainKey = absolute ? 'asset' : 'realized'
  const totalKey = absolute ? 'assetTotal' : 'total'
  const title = absolute ? '총자산 추이' : '누적 손익 · 총자산 추이'

  return (
    <>
      {/* 총자산 / 손익 추이 */}
      <div className="card">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-gray-900" /> 실현 누적
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
              평가손익 포함(현재)
            </span>
          </div>
        </div>
        {assetTrend.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            청산된 거래나 보유 종목이 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={assetTrend} margin={{ top: 5, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#111827" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={70}
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <Tooltip
                formatter={(v: number, name) => [
                  absolute ? formatWon(v) : won(v),
                  String(name),
                ]}
                labelFormatter={(l) => (l === '현재' ? '현재 (평가 포함)' : `${l}`)}
              />
              <ReferenceLine
                y={absolute ? initialCapital : 0}
                stroke="#cbd5e1"
                strokeDasharray="4 4"
                label={{
                  value: absolute ? '초기원금' : '손익 0',
                  position: 'insideTopLeft',
                  fontSize: 10,
                  fill: '#94a3b8',
                }}
              />
              <Area
                type="monotone"
                dataKey={mainKey}
                name={absolute ? '총자산(실현)' : '실현 누적손익'}
                stroke="#111827"
                strokeWidth={2}
                fill="url(#assetFill)"
                connectNulls
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={totalKey}
                name={absolute ? '총자산(평가포함)' : '평가 포함 총손익'}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 4"
                connectNulls
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            </ComposedChart>
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
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [won(v), '손익']} />
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
                  formatter={(v: number, _n, p) => [won(v), `손익 (${p.payload.count}건)`]}
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
    </>
  )
}
