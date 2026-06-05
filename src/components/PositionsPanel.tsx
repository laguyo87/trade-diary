import { useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../hooks/useStore'
import type { Quote } from '../types'
import { portfolioValue, valuePositions } from '../lib/stats'
import { fetchQuotes } from '../lib/quotes'
import { isKoreanMarketOpen, marketSessionLabel } from '../lib/market'
import {
  formatNumber,
  formatPct,
  formatSignedWon,
  formatWon,
  pnlColor,
} from '../lib/format'

function timeAgo(iso?: string): string {
  if (!iso) return ''
  const t = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`
}

export function PositionsPanel({ store }: { store: Store }) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ code: string; message: string }[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [session, setSession] = useState(() => marketSessionLabel())

  const valued = useMemo(
    () => valuePositions(store.openPositions, store.quotes),
    [store.openPositions, store.quotes],
  )
  const pv = useMemo(() => portfolioValue(valued), [valued])

  // 최신 갱신 시각 (보유 종목 quote 중 가장 최근)
  const lastUpdated = useMemo(() => {
    const times = store.openPositions
      .map((p) => store.quotes[p.stockCode]?.updatedAt)
      .filter(Boolean) as string[]
    if (!times.length) return undefined
    times.sort()
    return times[times.length - 1]
  }, [store.openPositions, store.quotes])

  const { autoRefresh, refreshIntervalSec = 30 } = store.settings

  // 동시 요청 방지용 ref (state 클로저 문제 회피)
  const fetchingRef = useRef(false)

  const refreshAll = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setErrors([])
    const codes = store.openPositions.map((p) => p.stockCode)
    const { quotes, errors } = await fetchQuotes(codes)
    store.setQuotes(quotes)
    setErrors(errors)
    setLoading(false)
    fetchingRef.current = false
  }

  // 장중 자동 갱신: 켜져 있고 보유 종목이 있으며 정규장일 때만 주기적으로 조회.
  useEffect(() => {
    if (!autoRefresh || store.openPositions.length === 0) return
    if (isKoreanMarketOpen()) void refreshAll() // 켜는 즉시 1회
    const id = window.setInterval(() => {
      setSession(marketSessionLabel())
      if (isKoreanMarketOpen()) void refreshAll()
    }, Math.max(5, refreshIntervalSec) * 1000)
    return () => window.clearInterval(id)
    // refreshAll은 매 렌더 새로 생성되므로 의존성에서 제외 (의도적)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshIntervalSec, store.openPositions.length])

  // 세션 라벨 1분마다 갱신 (자동갱신 꺼져 있어도 배지 최신화)
  useEffect(() => {
    const id = window.setInterval(() => setSession(marketSessionLabel()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const refreshOne = async (code: string) => {
    setLoading(true)
    const { quotes, errors } = await fetchQuotes([code])
    store.setQuotes(quotes)
    setErrors((prev) => [...prev.filter((e) => e.code !== code), ...errors])
    setLoading(false)
  }

  const saveManual = (code: string, name: string) => {
    const raw = drafts[code]
    if (raw == null) return
    const price = parseFloat(raw.replace(/[,\s원]/g, ''))
    setDrafts((d) => {
      const next = { ...d }
      delete next[code]
      return next
    })
    if (!isFinite(price) || price <= 0) return
    const q: Quote = {
      code,
      price,
      name,
      updatedAt: new Date().toISOString(),
      manual: true,
    }
    store.setQuote(q)
  }

  if (store.openPositions.length === 0) return null

  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">미청산(보유) 포지션 · 평가손익</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              session === '장중'
                ? 'bg-green-50 text-green-600'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            ● {session}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={!!autoRefresh}
              onChange={(e) => store.updateSettings({ autoRefresh: e.target.checked })}
            />
            장중 자동 갱신
          </label>
          <select
            className="input w-auto py-1 text-xs disabled:opacity-50"
            value={refreshIntervalSec}
            disabled={!autoRefresh}
            onChange={(e) =>
              store.updateSettings({ refreshIntervalSec: parseInt(e.target.value, 10) })
            }
          >
            <option value={10}>10초</option>
            <option value={30}>30초</option>
            <option value={60}>1분</option>
            <option value={300}>5분</option>
          </select>
          <button className="btn-ghost" onClick={refreshAll} disabled={loading}>
            {loading ? '불러오는 중…' : '전체 현재가 불러오기'}
          </button>
        </div>
      </div>
      {(lastUpdated || autoRefresh) && (
        <div className="px-4 pt-1 text-[11px] text-gray-400">
          {lastUpdated && `최근 갱신 ${timeAgo(lastUpdated)}`}
          {autoRefresh &&
            (session === '장중'
              ? ` · ${refreshIntervalSec}초마다 자동 갱신 중`
              : ' · 장 시작 시 자동 갱신 재개')}
        </div>
      )}

      {/* 포트폴리오 요약 */}
      <div className="mt-3 grid grid-cols-2 gap-px bg-gray-100 text-center md:grid-cols-4">
        <div className="bg-white py-2">
          <div className="text-[11px] text-gray-500">평가원금</div>
          <div className="text-sm font-semibold tabular-nums">{formatWon(pv.cost)}</div>
        </div>
        <div className="bg-white py-2">
          <div className="text-[11px] text-gray-500">평가금액</div>
          <div className="text-sm font-semibold tabular-nums">{formatWon(pv.marketValue)}</div>
        </div>
        <div className="bg-white py-2">
          <div className="text-[11px] text-gray-500">평가손익</div>
          <div className={`text-sm font-semibold tabular-nums ${pnlColor(pv.unrealizedPnl)}`}>
            {formatSignedWon(pv.unrealizedPnl)}
          </div>
        </div>
        <div className="bg-white py-2">
          <div className="text-[11px] text-gray-500">평가수익률</div>
          <div className={`text-sm font-semibold tabular-nums ${pnlColor(pv.unrealizedPct)}`}>
            {formatPct(pv.unrealizedPct)}
          </div>
        </div>
      </div>

      {pv.valuedCount < pv.totalCount && (
        <div className="px-4 py-1.5 text-[11px] text-gray-400">
          {pv.totalCount}종목 중 {pv.valuedCount}종목만 현재가 반영됨 (나머지는 조회 또는 수동 입력 필요)
        </div>
      )}

      {errors.length > 0 && (
        <div className="mx-4 my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          일부 종목 자동 조회 실패: {errors.map((e) => e.code).join(', ')}. 현재가를 직접 입력하세요.
          <div className="mt-0.5 text-amber-500">{errors[0].message}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="mt-1 w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">종목</th>
              <th className="px-4 py-2 text-right font-medium">보유수량</th>
              <th className="px-4 py-2 text-right font-medium">평균매수가</th>
              <th className="px-4 py-2 text-right font-medium">현재가</th>
              <th className="px-4 py-2 text-right font-medium">평가금액</th>
              <th className="px-4 py-2 text-right font-medium">평가손익</th>
              <th className="px-4 py-2 text-right font-medium">수익률</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {valued.map((p) => {
              const draft = drafts[p.stockCode]
              const showVal = p.unrealizedPnl != null
              return (
                <tr key={p.key} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{p.stockName}</div>
                    <div className="text-xs text-gray-400">
                      {p.stockCode}
                      {p.account ? ` · ${p.account}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(p.quantity)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatWon(p.avgBuyPrice)}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      className="input w-28 py-1 text-right tabular-nums"
                      inputMode="decimal"
                      placeholder="직접 입력"
                      value={draft ?? (p.currentPrice != null ? formatNumber(p.currentPrice) : '')}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [p.stockCode]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      onBlur={() => saveManual(p.stockCode, p.stockName)}
                    />
                    <div className="mt-0.5 text-[10px] text-gray-400">
                      {p.changeRate != null && (
                        <span className={pnlColor(p.changeRate)}>{formatPct(p.changeRate)} </span>
                      )}
                      {p.quotedAt && (p.manualQuote ? '수동' : timeAgo(p.quotedAt))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {showVal ? formatWon(p.marketValue!) : '-'}
                  </td>
                  <td className={`px-4 py-2 text-right font-medium tabular-nums ${pnlColor(p.unrealizedPnl ?? 0)}`}>
                    {showVal ? formatSignedWon(p.unrealizedPnl!) : '-'}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${pnlColor(p.unrealizedPct ?? 0)}`}>
                    {showVal ? formatPct(p.unrealizedPct!) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-xs text-gray-400 hover:text-gray-700"
                      onClick={() => refreshOne(p.stockCode)}
                      disabled={loading}
                    >
                      조회
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-[11px] text-gray-400">
        현재가 자동 조회는 개발 서버(npm run dev)에서만 동작합니다. 그 외 환경에서는 현재가 칸에 직접 입력하세요.
      </div>
    </div>
  )
}
