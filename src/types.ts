// 매매구분
export type Side = 'buy' | 'sell'

// 단일 체결(거래) 기록
export interface Trade {
  id: string
  datetime: string // ISO local "YYYY-MM-DDTHH:mm"
  stockName: string
  stockCode: string // 6자리
  side: Side
  quantity: number
  price: number
  amount: number // quantity * price (거래금액)
  account?: string // 계좌번호 (마스킹된 형태 그대로 저장)
  fee?: number // 수수료/세금 (선택)
  source?: 'manual' | 'kakao' // 입력 출처
  memo?: string
}

// 라운드트립(매수→매도 한 사이클, FIFO 매칭 결과)
export interface RoundTrip {
  id: string // = 매도 체결의 trade id (안정적)
  stockCode: string
  stockName: string
  account?: string
  openDate: string // 매칭된 첫 매수 시각
  closeDate: string // 매도 시각
  quantity: number // 매칭 수량
  avgBuyPrice: number // 가중평균 매수 단가
  sellPrice: number // 매도 단가
  buyAmount: number // 매수 원금
  sellAmount: number // 매도 금액
  fee: number // 합산 수수료
  pnl: number // 실현손익 (sellAmount - buyAmount - fee)
  pnlPct: number // 수익률 %
  buyTradeIds: string[]
  sellTradeId: string
}

// 미청산(보유) 포지션
export interface OpenPosition {
  key: string
  stockCode: string
  stockName: string
  account?: string
  quantity: number
  avgBuyPrice: number
  cost: number // 보유 원금
}

// 복기 메모 (라운드트립 단위)
export interface JournalEntry {
  roundTripId: string
  strategy: string[]
  entryReason: string
  exitReason: string
  emotion: string
  lesson: string
  rating: number // 1~5
  updatedAt: string
}

// localStorage 저장 스냅샷
export interface StoreSnapshot {
  version: number
  trades: Trade[]
  journals: Record<string, JournalEntry>
  customStrategies: string[]
}
