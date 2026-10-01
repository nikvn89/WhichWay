import { keccak256, toHex } from 'viem'
import type { Address, BoundRecord } from './types'

const PYTHON_WS_RUN = /[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/gu
const PYTHON_WS_EDGES = /^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/gu
const RESERVED_TOKENS = [
  '<UNTRUSTED_BOUND_TEXT>', '</UNTRUSTED_BOUND_TEXT>',
  '<UNTRUSTED_OTHER_SIDE_LABEL>', '</UNTRUSTED_OTHER_SIDE_LABEL>',
  'IS_MINIMUM', 'IS_MAXIMUM', 'NOT_SETTLED',
]

export const pyStrip = (value: string) => String(value).replace(PYTHON_WS_EDGES, '')
export const pyLen = (value: string) => Array.from(String(value)).length

export function pyNormalize(value: string): string {
  const stripped = pyStrip(value)
  return stripped === '' ? '' : stripped.replace(PYTHON_WS_RUN, ' ')
}

export function hasReservedToken(value: string): boolean {
  const upper = value.toUpperCase()
  return RESERVED_TOKENS.some((token) => upper.includes(token))
}

export function computeBoundId(author: Address, text: string): string {
  const normalized = pyNormalize(text)
  const payload = `BOUND_DIRECTION:BOUND:V1|${author.toLowerCase()}|${pyLen(normalized)}|${normalized}`
  return keccak256(toHex(payload)).slice(2)
}

export function localVerdict(record: BoundRecord, value: bigint): 'WITHIN' | 'BREACH' {
  if (record.direction === 'FLOOR') return value < record.amount ? 'BREACH' : 'WITHIN'
  return value > record.amount ? 'BREACH' : 'WITHIN'
}

export function sentenceCase(value: string): string {
  return value.length ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

export function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/i.test(value)
}

export function isBoundId(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value)
}

export function short(value: string, lead = 7, tail = 5): string {
  return value.length > lead + tail + 2 ? `${value.slice(0, lead)}…${value.slice(-tail)}` : value
}

export function sameAddress(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}

export function safeBigInt(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null
  try { return BigInt(value) } catch { return null }
}

export function errorText(error: unknown): string {
  const seen = new Set<unknown>()
  const messages: string[] = []
  const visit = (value: unknown): void => {
    if (value == null || seen.has(value)) return
    seen.add(value)
    if (typeof value === 'string') messages.push(value)
    else if (value instanceof Error) {
      messages.push(value.message)
      visit((value as Error & { cause?: unknown }).cause)
    } else if (typeof value === 'object') {
      const item = value as Record<string, unknown>
      for (const key of ['shortMessage', 'message', 'details', 'reason', 'error', 'cause', 'data']) visit(item[key])
    }
  }
  visit(error)
  const joined = messages.join(' · ')
  const rollback = joined.match(/(?:UserError|\[rollback\])[:\s]*(.*?)(?:\n|$| · )/i)
  return (rollback?.[1] || messages[0] || 'The request could not be completed.').replace(/^['"]|['"]$/g, '')
}
