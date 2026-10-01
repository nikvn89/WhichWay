export type Address = `0x${string}`

export type BoundRecord = {
  bound_id: string
  author: string
  other_wallet: string
  other_label: string
  text: string
  amount: bigint
  direction: 'FLOOR' | 'CEILING'
  operator: string
  state: 'OPEN' | 'SEALED'
  reading_count: number
  breach_count: number
}

export type Reading = {
  bound_id: string
  index: number
  value: bigint
  verdict: 'WITHIN' | 'BREACH'
  disputed: boolean
  dispute_note: string
}

export type LoadedBound = {
  record: BoundRecord
  readings: Reading[]
}

export type TxPhase = 'idle' | 'wallet' | 'submitted' | 'confirmed' | 'error'

export type TxState = {
  phase: TxPhase
  label: string
  hash?: Address
  message?: string
}
