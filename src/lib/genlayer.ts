import { abi, createClient } from 'genlayer-js'
import { ExecutionResult } from 'genlayer-js/types'
import { CONTRACT_ADDRESS, proxiedStudioNet, STUDIO_CHAIN_HEX, STUDIO_CHAIN_PARAMS } from './config'
import type { Address, BoundRecord, LoadedBound, Reading } from './types'
import { errorText } from './utils'

const readClient = createClient({ chain: proxiedStudioNet as never })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class SubmittedUnconfirmedError extends Error {
  hash: Address
  constructor(hash: Address) {
    super('Submitted — confirmation delayed. Check Explorer before trying again.')
    this.name = 'SubmittedUnconfirmedError'
    this.hash = hash
  }
}

class ContractExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractExecutionError'
  }
}

export async function ensureStudioNet(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask was not found.')
  const current = String(await window.ethereum.request({ method: 'eth_chainId' })).toLowerCase()
  if (current === STUDIO_CHAIN_HEX) return
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIO_CHAIN_HEX }],
    })
  } catch (error) {
    const code = Number((error as { code?: unknown })?.code)
    if (code !== 4902) throw error
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [STUDIO_CHAIN_PARAMS] })
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIO_CHAIN_HEX }],
    })
  }
}

export async function connectedAccount(request = false): Promise<Address | null> {
  if (!window.ethereum) return null
  const method = request ? 'eth_requestAccounts' : 'eth_accounts'
  const accounts = await window.ethereum.request({ method }) as string[]
  return accounts?.[0] as Address | undefined || null
}

export async function connectWallet(): Promise<Address> {
  if (!window.ethereum) throw new Error('MetaMask was not found.')
  const account = await connectedAccount(true)
  if (!account) throw new Error('No wallet account was returned.')
  await ensureStudioNet()
  return account
}

function writeClient(account: Address) {
  if (!window.ethereum) throw new Error('MetaMask was not found.')
  return createClient({
    chain: proxiedStudioNet as never,
    account,
    provider: window.ethereum as never,
  })
}

async function retry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i += 1) {
    try { return await fn() } catch (error) {
      last = error
      if (i < attempts - 1) await sleep(450 * (2 ** i))
    }
  }
  throw last
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try { return JSON.parse(value) as Record<string, unknown> } catch { return {} }
  }
  return {}
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
  }
  return []
}

function normalizeBound(value: unknown): BoundRecord | null {
  const item = toObject(value)
  if (!item.bound_id) return null
  return {
    bound_id: String(item.bound_id),
    author: String(item.author),
    other_wallet: String(item.other_wallet),
    other_label: String(item.other_label),
    text: String(item.text),
    amount: BigInt(String(item.amount)),
    direction: String(item.direction) as BoundRecord['direction'],
    operator: String(item.operator),
    state: String(item.state) as BoundRecord['state'],
    reading_count: Number(item.reading_count),
    breach_count: Number(item.breach_count),
  }
}

function normalizeReading(value: unknown): Reading | null {
  const item = toObject(value)
  if (!item.bound_id || !item.index) return null
  return {
    bound_id: String(item.bound_id),
    index: Number(item.index),
    value: BigInt(String(item.value)),
    verdict: String(item.verdict) as Reading['verdict'],
    disputed: Boolean(item.disputed),
    dispute_note: String(item.dispute_note ?? ''),
  }
}

async function read(functionName: string, args: unknown[]): Promise<unknown> {
  return retry(() => readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never[],
    jsonSafeReturn: true,
    stateStatus: 'accepted',
  } as never) as Promise<unknown>)
}

export async function readBound(id: string): Promise<LoadedBound | null> {
  const record = normalizeBound(await read('get_bound', [id]))
  if (!record) return null
  const rows = toList(await read('get_readings', [id, 0, 50]))
    .map(normalizeReading)
    .filter((entry): entry is Reading => entry !== null)
  return { record, readings: rows }
}

export function calldataBytes(functionName: string, args: unknown[]): number {
  const object = abi.calldata.makeCalldataObject(functionName, args as never[], {})
  return abi.calldata.encode(object).length
}

function leaderReceipt(transaction: Record<string, unknown>): Record<string, unknown> | null {
  const consensus = transaction.consensus_data as Record<string, unknown> | undefined
  const raw = consensus?.leader_receipt
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : []
  return (rows.find((row) => String((row as Record<string, unknown>).mode).toLowerCase() === 'leader')
    || rows[0] || null) as Record<string, unknown> | null
}

async function waitForExplicitResult(hash: Address, timeoutMs = 72_000): Promise<void> {
  const start = Date.now()
  let lastError: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      const tx = await readClient.getTransaction({ hash: hash as never }) as unknown as Record<string, unknown>
      const status = String(tx.statusName ?? tx.status ?? '').toUpperCase()
      const execution = String(tx.txExecutionResultName ?? '').toUpperCase()
      const leader = leaderReceipt(tx)
      const leaderExecution = String(leader?.execution_result ?? '').toUpperCase()
      const decided = status.includes('ACCEPTED') || status.includes('FINALIZED')

      if (decided && (execution === ExecutionResult.FINISHED_WITH_ERROR || leaderExecution === 'ERROR')) {
        throw new ContractExecutionError(errorText(leader?.error || leader?.result || tx) || 'Contract execution failed.')
      }
      const explicitSuccess = execution === ExecutionResult.FINISHED_WITH_RETURN || leaderExecution === 'SUCCESS'
      if (decided && explicitSuccess) return
    } catch (error) {
      if (error instanceof ContractExecutionError) throw error
      lastError = error
    }
    await sleep(1600)
  }
  if (lastError) console.warn('[WhichWay] final receipt poll error', lastError)
  throw new SubmittedUnconfirmedError(hash)
}

export async function writeBound(params: {
  account: Address
  functionName: 'open_bound' | 'record_reading' | 'dispute_reading' | 'seal_bound'
  args: unknown[]
  onHash?: (hash: Address) => void
}): Promise<Address> {
  await ensureStudioNet()
  const client = writeClient(params.account)
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: params.functionName,
    args: params.args as never[],
    value: 0n,
  }) as Address
  params.onHash?.(hash)
  await waitForExplicitResult(hash)
  return hash
}
