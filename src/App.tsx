import { useState } from 'react'
import { useStore } from './hooks/useStore'
import { Dashboard } from './components/Dashboard'
import { TradeList } from './components/TradeList'
import { Journal } from './components/Journal'
import { ImportPanel } from './components/ImportPanel'

type Tab = 'dashboard' | 'trades' | 'journal' | 'import'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'trades', label: '매매 기록' },
  { id: 'journal', label: '복기 일지' },
  { id: 'import', label: '가져오기' },
]

export default function App() {
  const store = useStore()
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-base font-bold text-gray-900">
              📈 매매 일지
              <span className="ml-2 text-xs font-normal text-gray-400">한국 주식 · 로컬 저장</span>
            </h1>
            <span className="text-xs text-gray-400">
              거래 {store.trades.length} · 청산 {store.roundTrips.length}
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {tab === 'dashboard' && <Dashboard store={store} />}
        {tab === 'trades' && <TradeList store={store} />}
        {tab === 'journal' && <Journal store={store} />}
        {tab === 'import' && <ImportPanel store={store} />}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-gray-400">
        모든 데이터는 이 브라우저(localStorage)에만 저장됩니다. 기기 이전 시 [가져오기] 탭에서 백업하세요.
      </footer>
    </div>
  )
}
