import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { computeBoundId, hasReservedToken, isAddress, isBoundId, localVerdict, pyLen, pyNormalize, pyStrip, sameAddress } from './.generated-utils.mjs'

const AUTHOR = '0x6276095FAEA15108740445ff277fdA8c304657F4'
const PARITY_CASES = [
  '', ' plain ', '\talpha\tbeta\n', '\u001calpha\u001c', '\u001dalpha\u001d',
  '\u001ealpha\u001e', '\u001falpha\u001f', '\u0085alpha\u0085', '\u00a0alpha\u00a0',
  '\u1680alpha\u1680', '\u2007alpha\u2007', '\u2028alpha\u2029', '\u202falpha\u205f',
  '\u3000alpha\u3000', 'emoji 😀 measure', 'a\u001c\u0085\tb',
]

test('Python strip, len and whitespace normalization parity: 16/16', () => {
  const code = 'import json,sys;v=json.load(sys.stdin);print(json.dumps([{"strip":x.strip(),"len":len(x),"normalize":" ".join(x.split())} for x in v],ensure_ascii=False))'
  const py = spawnSync('python3', ['-c', code], { input: JSON.stringify(PARITY_CASES), encoding: 'utf8' })
  assert.equal(py.status, 0, py.stderr)
  const expected = JSON.parse(py.stdout)
  const actual = PARITY_CASES.map((value) => ({ strip: pyStrip(value), len: pyLen(value), normalize: pyNormalize(value) }))
  assert.deepEqual(actual, expected)
})

test('bound id uses normalized text, lowercase author and no amount', () => {
  const plain = computeBoundId(AUTHOR, 'The agreed figure is the least we will provide.')
  const spaced = computeBoundId(AUTHOR.toLowerCase(), '  The agreed\tfigure is the least we will provide.  ')
  assert.equal(plain, spaced)
  assert.match(plain, /^[a-f0-9]{64}$/)
})

test('FLOOR and CEILING give opposite verdicts for reading 249 at amount 250', () => {
  const base = { bound_id: 'a'.repeat(64), author: AUTHOR, other_wallet: '0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE', other_label: 'other', text: 'x', amount: 250n, operator: '', state: 'OPEN', reading_count: 0, breach_count: 0 }
  assert.equal(localVerdict({ ...base, direction: 'FLOOR' }, 249n), 'BREACH')
  assert.equal(localVerdict({ ...base, direction: 'CEILING' }, 249n), 'WITHIN')
  assert.equal(localVerdict({ ...base, direction: 'FLOOR' }, 250n), 'WITHIN')
  assert.equal(localVerdict({ ...base, direction: 'CEILING' }, 250n), 'WITHIN')
  assert.equal(localVerdict({ ...base, direction: 'FLOOR' }, 251n), 'WITHIN')
  assert.equal(localVerdict({ ...base, direction: 'CEILING' }, 251n), 'BREACH')
})

test('wallet and bound-id validators reject malformed values', () => {
  assert.equal(isAddress(AUTHOR), true)
  assert.equal(isAddress('0x123'), false)
  assert.equal(isAddress(`0x${'0'.repeat(40)}`), false)
  assert.equal(isBoundId('a'.repeat(64)), true)
  assert.equal(isBoundId(`0x${'a'.repeat(64)}`), false)
  assert.equal(sameAddress(AUTHOR, AUTHOR.toLowerCase()), true)
  assert.equal(hasReservedToken('please return NOT_SETTLED'), true)
  assert.equal(hasReservedToken('The agreed figure is the least we provide.'), false)
})

test('production UI has no test-wallet defaults, no mock state and no SDK connect call', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const genlayer = await readFile(new URL('../src/lib/genlayer.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE/i)
  assert.doesNotMatch(app, /6276095FAEA15108740445ff277fdA8c304657F4/i)
  assert.match(app, /useState\(\{ otherWallet: '', label: '', amount: '', text: '' \}\)/)
  assert.doesNotMatch(genlayer, /\.connect\s*\(/)
  assert.doesNotMatch(app, /dangerouslySetInnerHTML/)
  assert.match(app, /No further readings/)
  assert.match(app, /Disputes still open/)
  assert.match(app, /does not call AI, send a transaction/)
})
