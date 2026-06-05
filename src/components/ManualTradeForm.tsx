import { useMemo, useState } from 'react'
import type { Side, Trade } from '../types'
import { formatWon } from '../lib/format'

interface Props {
  onAdd: (t: Trade) => void
}

function nowLocalInput(): string {
  // datetime-local 기본값: 현재 시각 (로컬)
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export function ManualTradeForm({ onAdd }: Props) {
  const [datetime, setDatetime] = useState(nowLocalInput())
  const [stockName, setStockName] = useState('')
  const [stockCode, setStockCode] = useState('')
  const [side, setSide] = useState<Side>('buy')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [account, setAccount] = useState('')
  const [fee, setFee] = useState('')

  const qty = parseFloat(quantity)
  const prc = parseFloat(price)
  const amount = useMemo(
    () => (isFinite(qty) && isFinite(prc) ? qty * prc : 0),
    [qty, prc],
  )

  const valid =
    stockName.trim() !== '' &&
    /^\d{6}$/.test(stockCode.trim()) &&
    isFinite(qty) &&
    qty > 0 &&
    isFinite(prc) &&
    prc > 0 &&
    datetime !== ''

  const submit = () => {
    if (!valid) return
    const feeNum = parseFloat(fee)
    const t: Trade = {
      id: crypto.randomUUID(),
      datetime: datetime.slice(0, 16),
      stockName: stockName.trim(),
      stockCode: stockCode.trim(),
      side,
      quantity: qty,
      price: prc,
      amount,
      account: account.trim() || undefined,
      fee: isFinite(feeNum) ? feeNum : undefined,
      source: 'manual',
    }
    onAdd(t)
    // 입력 일부 초기화 (날짜/계좌는 유지해 연속입력 편의)
    setStockName('')
    setStockCode('')
    setQuantity('')
    setPrice('')
    setFee('')
  }

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">수동 입력</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <label className="label">날짜/시간</label>
          <input
            type="datetime-local"
            className="input"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
        </div>
        <div>
          <label className="label">매매구분</label>
          <div className="flex gap-1">
            <button
              type="button"
              className={`btn flex-1 ${
                side === 'buy'
                  ? 'bg-profit text-white'
                  : 'border border-gray-300 bg-white text-gray-600'
              }`}
              onClick={() => setSide('buy')}
            >
              매수
            </button>
            <button
              type="button"
              className={`btn flex-1 ${
                side === 'sell'
                  ? 'bg-loss text-white'
                  : 'border border-gray-300 bg-white text-gray-600'
              }`}
              onClick={() => setSide('sell')}
            >
              매도
            </button>
          </div>
        </div>
        <div>
          <label className="label">종목명</label>
          <input
            className="input"
            placeholder="삼성전자"
            value={stockName}
            onChange={(e) => setStockName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">종목코드 (6자리)</label>
          <input
            className="input"
            placeholder="005930"
            inputMode="numeric"
            maxLength={6}
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div>
          <label className="label">수량</label>
          <input
            className="input"
            inputMode="numeric"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <label className="label">단가</label>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="label">계좌번호 (선택)</label>
          <input
            className="input"
            placeholder="64****22-29"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">수수료/세금 (선택)</label>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          거래금액 <span className="font-semibold text-gray-900">{formatWon(amount)}</span>
        </div>
        <button className="btn-primary" disabled={!valid} onClick={submit}>
          기록 추가
        </button>
      </div>
    </div>
  )
}
