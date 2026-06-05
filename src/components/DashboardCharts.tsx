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
import type { EquityPoint, GroupPnl } from '../lib/stats'
import { formatNumber, formatSignedWon } from '../lib/format'

// recharts를 사용하는 부분만 분리한 컴포넌트.
// Dashboard에서 React.lazy로 동적 import 하므로 recharts는 별도 청크로
// 분리되어 대시보드 탭을 열 때만 로드된다.

const PROFIT = '#e03131'
const LOSS = '#1971c2'

const won = (v: number | string) => formatSignedWon(Number(v))

interface Props {
  curve: EquityPoint[]
  byStock: GroupPnl[]
  byStrategy: GroupPnl[]
}

export default function DashboardCharts({ curve, byStock, byStrategy }: Props) {
  return (
    <>
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
                formatter={(v: number) => [won(v), '누적손익']}
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
