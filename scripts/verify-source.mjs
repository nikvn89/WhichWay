import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../contracts/BoundDirection.py', import.meta.url), 'utf8')
const expectedLine = await readFile(new URL('../SOURCE_SHA256.txt', import.meta.url), 'utf8')
const expected = expectedLine.trim().split(/\s+/)[0]
const normalized = source.replace(/\r\n/g, '\n').replace(/\n?$/, '\n')
const actual = createHash('sha256').update(normalized).digest('hex')

console.log(`expected ${expected}`)
console.log(`actual   ${actual}`)
if (actual !== expected) {
  console.error('FAIL: contract source differs from the frozen deployment source.')
  process.exit(1)
}
console.log('PASS: frozen contract source is byte-equivalent after CRLF/LF normalization.')
