import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JournalEntry, Quote, Settings, StoreSnapshot, Trade } from '../types'
import {
  DEFAULT_STRATEGIES,
  loadSnapshot,
  mergeTrades,
  saveSnapshot,
} from '../lib/storage'
import { matchRoundTrips } from '../lib/roundtrip'

export function useStore() {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(() => loadSnapshot())

  // 변경 시마다 localStorage 영속화
  useEffect(() => {
    saveSnapshot(snapshot)
  }, [snapshot])

  const { trades, journals, customStrategies, quotes, indexCache, settings } = snapshot

  const addTrade = useCallback((t: Trade) => {
    setSnapshot((s) => {
      const { merged } = mergeTrades(s.trades, [t])
      return { ...s, trades: merged }
    })
  }, [])

  /** 여러 건 병합(import/파서). 추가/중복 건수 반환. */
  const addTrades = useCallback((incoming: Trade[]) => {
    let result = { added: 0, skipped: 0 }
    setSnapshot((s) => {
      const { merged, added, skipped } = mergeTrades(s.trades, incoming)
      result = { added, skipped }
      return { ...s, trades: merged }
    })
    return result
  }, [])

  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    setSnapshot((s) => ({
      ...s,
      trades: s.trades.map((t) =>
        t.id === id
          ? {
              ...t,
              ...patch,
              amount: (patch.quantity ?? t.quantity) * (patch.price ?? t.price),
            }
          : t,
      ),
    }))
  }, [])

  const deleteTrade = useCallback((id: string) => {
    setSnapshot((s) => ({ ...s, trades: s.trades.filter((t) => t.id !== id) }))
  }, [])

  const clearAll = useCallback(() => {
    setSnapshot((s) => ({
      version: 1,
      trades: [],
      journals: {},
      customStrategies: [],
      quotes: {},
      indexCache: {},
      settings: s.settings, // 설정(자동갱신/초기원금)은 유지
    }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSnapshot((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  /** 현재가 설정/갱신 (자동 조회 결과 또는 수동 입력) */
  const setQuote = useCallback((q: Quote) => {
    setSnapshot((s) => ({ ...s, quotes: { ...s.quotes, [q.code]: q } }))
  }, [])

  const setQuotes = useCallback((qs: Quote[]) => {
    if (qs.length === 0) return
    setSnapshot((s) => {
      const next = { ...s.quotes }
      for (const q of qs) next[q.code] = q
      return { ...s, quotes: next }
    })
  }, [])

  /** 시장지수 일별 종가 시리즈를 캐시에 병합 */
  const mergeIndexSeries = useCallback(
    (market: string, series: Record<string, number>) => {
      if (!market || Object.keys(series).length === 0) return
      setSnapshot((s) => ({
        ...s,
        indexCache: { ...s.indexCache, [market]: { ...s.indexCache[market], ...series } },
      }))
    },
    [],
  )

  const saveJournal = useCallback((entry: JournalEntry) => {
    setSnapshot((s) => ({
      ...s,
      journals: { ...s.journals, [entry.roundTripId]: entry },
    }))
  }, [])

  const addStrategy = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSnapshot((s) =>
      s.customStrategies.includes(trimmed) || DEFAULT_STRATEGIES.includes(trimmed)
        ? s
        : { ...s, customStrategies: [...s.customStrategies, trimmed] },
    )
  }, [])

  const replaceSnapshot = useCallback((next: StoreSnapshot) => {
    setSnapshot(next)
  }, [])

  // 파생 데이터 — 라운드트립/미청산
  const { roundTrips, openPositions } = useMemo(() => matchRoundTrips(trades), [trades])

  const allStrategies = useMemo(
    () => [...DEFAULT_STRATEGIES, ...customStrategies],
    [customStrategies],
  )

  return {
    snapshot,
    trades,
    journals,
    customStrategies,
    quotes,
    indexCache,
    settings,
    allStrategies,
    roundTrips,
    openPositions,
    addTrade,
    addTrades,
    updateTrade,
    deleteTrade,
    clearAll,
    saveJournal,
    addStrategy,
    setQuote,
    setQuotes,
    mergeIndexSeries,
    updateSettings,
    replaceSnapshot,
  }
}

export type Store = ReturnType<typeof useStore>
