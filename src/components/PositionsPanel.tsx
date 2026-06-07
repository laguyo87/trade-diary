import { useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../hooks/useStore'
import type { Quote } from '../types'
import { portfolioValue, valuePositions } from '../lib/stats'
import { fetchQuotes } from '../lib/quotes'
import { computeRelativeStop, fetchIndexSeries, toYmd } from '../lib/indexQuotes'
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
  // 마운트 시 1회 자동 조회 가드
  const initedRef = useRef(false)

  const refreshAll = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setErrors([])
    const codes = store.openPositions.map((p) => p.stockCode)
    const { quotes, errors } = await fetchQuotes(codes)
    store.setQuotes(quotes)
    setErrors(errors)
    // 지수 대비 손절 기준용: 보유 시장별 지수 일별 종가 확보
    await refreshIndexes(quotes)
    setLoading(false)
    fetchingRef.current = false
  }

  /** 보유 종목 시장(KOSPI/KOSDAQ)별 지수 일별 종가를 가장 이른 진입일~오늘 범위로 받아 캐시 병합 */
  const refreshIndexes = async (latestQuotes: Quote[]) => {
    const byCode = new Map(latestQuotes.map((q) => [q.code, q]))
    const earliest = new Map<string, string>() // market → 가장 이른 진입 ymd
    for (const p of store.openPositions) {
      const mkt = byCode.get(p.stockCode)?.market ?? store.quotes[p.stockCode]?.market
      if (mkt !== 'KOSPI' && mkt !== 'KOSDAQ') continue
      const ymd = toYmd(p.openDate)
      const cur = earliest.get(mkt)
      if (!cur || ymd < cur) earliest.set(mkt, ymd)
    }
    if (earliest.size === 0) return
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const end = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    await Promise.all(
      [...earliest.entries()].map(async ([mkt, start]) => {
        const series = await fetchIndexSeries(mkt, start, end)
        store.mergeIndexSeries(mkt, series)
      }),
    )
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

  // 대시보드를 열 때, 보유 종목은 있는데 현재가/지수 데이터가 없으면 자동으로 1회 조회.
  // (현재가·지수 캐시가 이미 있으면 불필요한 요청을 보내지 않음)
  useEffect(() => {
    if (initedRef.current || store.openPositions.length === 0) return
    const missingQuote = store.openPositions.some((p) => !store.quotes[p.stockCode])
    const missingIndex = Object.keys(store.indexCache).length === 0
    if (!missingQuote && !missingIndex) return
    initedRef.current = true
    void refreshAll()
    // refreshAll은 매 렌더 새로 생성되므로 의존성에서 제외 (의도적)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.openPositions.length])

  const refreshOne = async (code: string) => {
    setLoading(true)
    const { quotes, errors } = await fetchQuotes([code])
    store.setQuotes(quotes)
    setErrors((prev) => [...prev.filter((e) => e.code !== code), ...errors])
    // 개별 조회에서도 지수(지수 대비 손절 기준)를 함께 받아온다
    await refreshIndexes(quotes)
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
        <table className="mt-1 w-full min-w-[940px] text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">종목</th>
              <th className="px-4 py-2 text-right font-medium">보유수량</th>
              <th className="px-4 py-2 text-right font-medium">평균매수가</th>
              <th className="px-4 py-2 text-right font-medium">현재가</th>
              <th className="px-4 py-2 text-right font-medium">평가금액</th>
              <th className="px-4 py-2 text-right font-medium">평가손익</th>
              <th className="px-4 py-2 text-right font-medium">수익률</th>
              <th className="px-4 py-2 text-right font-medium">
                지수 대비
                <span className="block text-[10px] font-normal text-gray-400">-10% 손절 기준</span>
              </th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {valued.map((p) => {
              const draft = drafts[p.stockCode]
              const showVal = p.unrealizedPnl != null
              const rel = computeRelativeStop({
                market: store.quotes[p.stockCode]?.market,
                entryDate: p.openDate,
                stockReturnPct: p.unrealizedPct,
                indexCache: store.indexCache,
              })
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
                    {rel == null ? (
                      <span className="text-xs text-gray-300" title="현재가·지수 데이터가 필요합니다 ('전체 현재가 불러오기')">
                        -
                      </span>
                    ) : (
                      <span
                        className="inline-flex flex-col items-end"
                        title={`종목 ${formatPct(rel.stockReturnPct)} − 지수 ${formatPct(
                          rel.indexReturnPct,
                        )} = ${formatPct(rel.relativePct)}\n${rel.market} 진입 ${rel.entryYmd} 종가 ${formatNumber(
                          rel.entryIndex,
                        )} → 현재 ${rel.currentYmd} 종가 ${formatNumber(rel.currentIndex)}`}
                      >
                        {rel.reached ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                            손절 {formatPct(rel.relativePct)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium tabular-nums text-gray-700">
                            {formatPct(rel.relativePct)}
                          </span>
                        )}
                        <span className="mt-0.5 text-[10px] text-gray-400 tabular-nums">
                          종목{formatPct(rel.stockReturnPct)} / 지수{formatPct(rel.indexReturnPct)}
                        </span>
                      </span>
                    )}
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

      <div className="px-4 py-2 text-[11px] leading-relaxed text-gray-400">
        · 자동 조회(현재가·지수)는 데스크톱 앱 또는 개발 서버(npm run dev)에서 동작합니다. 그 외 환경에서는 현재가를 직접 입력하세요.
        <br />· <b>지수 대비 -10% 손절</b>: 진입(매수)일 이후 <b>누적</b>으로 <b>(종목 수익률 − 시장지수 수익률)</b>이 -10% 이하면 손절 신호입니다.
        종가 기준이며, 코스피/코스닥 종목만 산출됩니다. (마우스를 올리면 상세 계산이 보입니다)
      </div>
    </div>
  )
}
