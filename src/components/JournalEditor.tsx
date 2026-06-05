import { useEffect, useState } from 'react'
import type { JournalEntry, RoundTrip } from '../types'
import { StarRating } from './StarRating'

interface Props {
  roundTrip: RoundTrip
  entry?: JournalEntry
  strategies: string[]
  onSave: (e: JournalEntry) => void
  onAddStrategy: (name: string) => void
}

function blank(id: string): JournalEntry {
  return {
    roundTripId: id,
    strategy: [],
    entryReason: '',
    exitReason: '',
    emotion: '',
    lesson: '',
    rating: 0,
    updatedAt: '',
  }
}

export function JournalEditor({
  roundTrip,
  entry,
  strategies,
  onSave,
  onAddStrategy,
}: Props) {
  const [draft, setDraft] = useState<JournalEntry>(entry ?? blank(roundTrip.id))
  const [newTag, setNewTag] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(entry ?? blank(roundTrip.id))
  }, [entry, roundTrip.id])

  const toggleTag = (tag: string) => {
    setSaved(false)
    setDraft((d) => ({
      ...d,
      strategy: d.strategy.includes(tag)
        ? d.strategy.filter((s) => s !== tag)
        : [...d.strategy, tag],
    }))
  }

  const set = (patch: Partial<JournalEntry>) => {
    setSaved(false)
    setDraft((d) => ({ ...d, ...patch }))
  }

  const addTag = () => {
    const t = newTag.trim()
    if (!t) return
    onAddStrategy(t)
    if (!draft.strategy.includes(t)) toggleTag(t)
    setNewTag('')
  }

  const save = () => {
    const isoNow = new Date().toISOString()
    onSave({ ...draft, updatedAt: isoNow })
    setSaved(true)
  }

  return (
    <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 p-4">
      <div>
        <label className="label">전략 태그</label>
        <div className="flex flex-wrap gap-1.5">
          {strategies.map((s) => {
            const on = draft.strategy.includes(s)
            return (
              <span
                key={s}
                onClick={() => toggleTag(s)}
                className={`chip ${
                  on
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {s}
              </span>
            )
          })}
          <span className="inline-flex items-center gap-1">
            <input
              className="w-24 rounded-full border border-gray-300 px-2.5 py-1 text-xs outline-none focus:border-gray-900"
              placeholder="+ 직접 추가"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">진입 이유</label>
          <textarea
            className="input h-20"
            value={draft.entryReason}
            onChange={(e) => set({ entryReason: e.target.value })}
          />
        </div>
        <div>
          <label className="label">청산 이유</label>
          <textarea
            className="input h-20"
            value={draft.exitReason}
            onChange={(e) => set({ exitReason: e.target.value })}
          />
        </div>
        <div>
          <label className="label">감정 / 심리</label>
          <textarea
            className="input h-20"
            placeholder="진입·보유·청산 시 느낀 감정"
            value={draft.emotion}
            onChange={(e) => set({ emotion: e.target.value })}
          />
        </div>
        <div>
          <label className="label">배운 점</label>
          <textarea
            className="input h-20"
            placeholder="다음에 반복/개선할 점"
            value={draft.lesson}
            onChange={(e) => set({ lesson: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600">자기평가</span>
          <StarRating value={draft.rating} onChange={(v) => set({ rating: v })} />
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">저장됨 ✓</span>}
          <button className="btn-primary" onClick={save}>
            복기 저장
          </button>
        </div>
      </div>
    </div>
  )
}
