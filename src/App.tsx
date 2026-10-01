import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CONTRACT_ADDRESS, EXPLORER_BASE, RECENT_IDS_KEY } from './lib/config'
import { calldataBytes, connectWallet, connectedAccount, readBound, writeBound, SubmittedUnconfirmedError } from './lib/genlayer'
import type { Address, LoadedBound, Reading, TxState } from './lib/types'
import {
  computeBoundId,
  errorText,
  hasReservedToken,
  isAddress,
  isBoundId,
  localVerdict,
  pyLen,
  pyStrip,
  safeBigInt,
  sameAddress,
  sentenceCase,
  short,
} from './lib/utils'

const MAX_AMOUNT = 10n ** 18n
const EMPTY_TX: TxState = { phase: 'idle', label: '' }

function explorer(path: 'address' | 'tx', value: string): string {
  return `${EXPLORER_BASE}/${path}/${value}`
}

function copy(value: string): void {
  void navigator.clipboard.writeText(value)
}

function txError(error: unknown, label: string): TxState {
  if (error instanceof SubmittedUnconfirmedError) {
    return { phase: 'submitted', label, hash: error.hash, message: error.message }
  }
  return { phase: 'error', label, message: errorText(error) }
}

type BoundPanelProps = {
  data: LoadedBound
  account: Address | null
  busy: boolean
  onRecord(value: bigint): Promise<boolean>
  onDispute(reading: Reading, note: string): Promise<boolean>
  onSeal(): Promise<boolean>
  onRefresh(): Promise<void>
  onCompare(side: 'left' | 'right'): void
}

function BoundPanel({ data, account, busy, onRecord, onDispute, onSeal, onRefresh, onCompare }: BoundPanelProps) {
  const { record, readings } = data
  const [readingValue, setReadingValue] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const isAuthor = sameAddress(account, record.author)
  const isOther = sameAddress(account, record.other_wallet)
  const canRecord = isAuthor && record.state === 'OPEN' && record.reading_count < 30
  const parsedReading = safeBigInt(readingValue)
  const readingInRange = parsedReading !== null && parsedReading >= 0n && parsedReading <= MAX_AMOUNT
  const canSubmitReading = canRecord && readingInRange
  const canSeal = isAuthor && record.state === 'OPEN' && record.reading_count > 0
  const roleRecordReason = !account
    ? 'Connect the author wallet first'
    : !isAuthor
      ? 'Only the author may record a reading'
      : record.state !== 'OPEN'
        ? 'This bound is sealed'
        : record.reading_count >= 30
          ? 'No room for further readings'
          : ''
  const recordReason = roleRecordReason || (readingValue && !readingInRange ? 'The reading is out of range' : '')
  const sealReason = !account
    ? 'Connect the author wallet first'
    : !isAuthor
      ? 'Only the author may seal this bound'
      : record.state !== 'OPEN'
        ? 'This bound is already sealed'
        : record.reading_count < 1
          ? 'Nothing has been recorded yet'
          : ''

  async function submitReading(event: FormEvent) {
    event.preventDefault()
    const value = safeBigInt(readingValue)
    if (value === null || value < 0n || value > MAX_AMOUNT) return
    if (await onRecord(value)) setReadingValue('')
  }

  return (
    <article className="bound-card">
      <div className="bound-card__top">
        <div>
          <p className="eyebrow">Loaded from accepted state</p>
          <h3>{record.other_label}</h3>
        </div>
        <span className={`state state--${record.state.toLowerCase()}`}>{record.state}</span>
      </div>

      <blockquote>{record.text}</blockquote>

      <div className="operator-line">
        <span className={`direction direction--${record.direction.toLowerCase()}`}>{record.direction}</span>
        <strong>{sentenceCase(record.operator)}.</strong>
      </div>

      <div className="stat-grid">
        <div><span>Amount</span><strong>{record.amount.toString()}</strong></div>
        <div><span>Readings</span><strong>{record.reading_count}</strong></div>
        <div><span>Breaches</span><strong>{record.breach_count}</strong></div>
      </div>

      <dl className="identity-list">
        <div><dt>Author</dt><dd title={record.author}>{short(record.author)} {isAuthor && <em>you</em>}</dd></div>
        <div><dt>Other side</dt><dd title={record.other_wallet}>{short(record.other_wallet)} {isOther && <em>you</em>}</dd></div>
        <div><dt>Bound ID</dt><dd title={record.bound_id}>{short(record.bound_id, 10, 8)} <button className="copy" onClick={() => copy(record.bound_id)}>Copy</button></dd></div>
      </dl>

      {record.state === 'SEALED' && (
        <div className="sealed-note"><strong>No further readings.</strong><span>Disputes still open.</span></div>
      )}

      <div className="card-actions">
        <button className="ghost" onClick={() => onCompare('left')}>Compare left</button>
        <button className="ghost" onClick={() => onCompare('right')}>Compare right</button>
        <button className="ghost" onClick={() => void onRefresh()} disabled={busy}>Refresh</button>
      </div>

      <form className="inline-form" onSubmit={(event) => void submitReading(event)}>
        <label>
          New numeric reading
          <input inputMode="numeric" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} placeholder="e.g. 249" />
        </label>
        <button className="primary" disabled={busy || !canSubmitReading}>Record reading</button>
      </form>
      {recordReason && <p className="action-reason">{recordReason}</p>}

      <div className="section-divider"><span>Immutable reading ledger</span></div>
      {readings.length === 0 ? (
        <p className="empty">No readings recorded yet.</p>
      ) : (
        <div className="reading-list">
          {readings.map((reading) => {
            const disputeReason = !account
              ? 'Connect the named other-side wallet first'
              : !isOther
                ? 'Only the named other side may dispute a reading'
                : reading.disputed
                  ? 'This reading has already been disputed'
                  : ''
            return (
              <div className="reading" key={reading.index}>
                <div className="reading__main">
                  <span className="reading__index">#{reading.index}</span>
                  <strong>{reading.value.toString()}</strong>
                  <span className={`verdict verdict--${reading.verdict.toLowerCase()}`}>{reading.verdict}</span>
                </div>
                {reading.disputed ? (
                  <p className="dispute"><span>Other-side note</span>{reading.dispute_note || '(intentionally empty)'}</p>
                ) : (
                  <div className="dispute-form">
                    <input
                      value={notes[reading.index] || ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [reading.index]: event.target.value }))}
                      placeholder="Immutable dispute note (60 characters max)"
                      maxLength={60}
                    />
                    <button
                      className="small"
                      disabled={busy || Boolean(disputeReason)}
                      onClick={() => void onDispute(reading, notes[reading.index] || '')}
                    >Dispute</button>
                    {disputeReason && <small>{disputeReason}</small>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button className="danger-line" disabled={busy || !canSeal} onClick={() => void onSeal()}>Seal this bound</button>
      {sealReason && <p className="action-reason">{sealReason}</p>}
    </article>
  )
}

export default function App() {
  const [account, setAccount] = useState<Address | null>(null)
  const [tx, setTx] = useState<TxState>(EMPTY_TX)
  const [activeTab, setActiveTab] = useState<'workspace' | 'compare' | 'guide'>('workspace')
  const [openForm, setOpenForm] = useState({ otherWallet: '', label: '', amount: '', text: '' })
  const [lookupId, setLookupId] = useState('')
  const [loaded, setLoaded] = useState<LoadedBound | null>(null)
  const [loadError, setLoadError] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [compareIds, setCompareIds] = useState({ left: '', right: '' })
  const [compareData, setCompareData] = useState<{ left: LoadedBound | null; right: LoadedBound | null }>({ left: null, right: null })
  const [compareValue, setCompareValue] = useState('249')
  const [compareError, setCompareError] = useState('')
  const busy = tx.phase === 'wallet' || tx.phase === 'submitted'

  useEffect(() => {
    void connectedAccount().then(setAccount)
    try { setRecentIds(JSON.parse(localStorage.getItem(RECENT_IDS_KEY) || '[]') as string[]) } catch { setRecentIds([]) }
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined
      setAccount((accounts?.[0] as Address | undefined) || null)
    }
    window.ethereum?.on?.('accountsChanged', handler)
    return () => window.ethereum?.removeListener?.('accountsChanged', handler)
  }, [])

  const openBytes = useMemo(() => {
    const amount = safeBigInt(openForm.amount)
    if (!isAddress(openForm.otherWallet) || amount === null) return null
    try { return calldataBytes('open_bound', [openForm.otherWallet, openForm.label, amount, openForm.text]) } catch { return null }
  }, [openForm])

  const remember = useCallback((id: string) => {
    setRecentIds((current) => {
      const next = [id, ...current.filter((entry) => entry !== id)].slice(0, 8)
      localStorage.setItem(RECENT_IDS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  async function handleConnect() {
    setTx({ phase: 'wallet', label: 'Connect wallet', message: 'Waiting for MetaMask…' })
    try {
      const next = await connectWallet()
      setAccount(next)
      setTx({ phase: 'confirmed', label: 'Wallet connected', message: 'GenLayer StudioNet is active.' })
    } catch (error) { setTx(txError(error, 'Connect wallet')) }
  }

  const loadById = useCallback(async (id: string, quiet = false): Promise<LoadedBound | null> => {
    if (!isBoundId(id)) {
      if (!quiet) setLoadError('Enter a 64-character bound ID without 0x.')
      return null
    }
    if (!quiet) setLoadError('')
    try {
      const state = await readBound(id.toLowerCase())
      if (!state) {
        if (!quiet) setLoadError('No accepted bound exists for this ID.')
        return null
      }
      if (!quiet) {
        setLoaded(state)
        setLookupId(id.toLowerCase())
      }
      remember(id.toLowerCase())
      return state
    } catch (error) {
      if (!quiet) setLoadError(errorText(error))
      return null
    }
  }, [remember])

  async function submitOpen(event: FormEvent) {
    event.preventDefault()
    if (!account) { setTx({ phase: 'error', label: 'Open bound', message: 'Connect the author wallet first.' }); return }
    const amount = safeBigInt(openForm.amount)
    const label = pyStrip(openForm.label)
    const text = pyStrip(openForm.text)
    let problem = ''
    if (!isAddress(openForm.otherWallet)) problem = 'Invalid wallet address'
    else if (sameAddress(account, openForm.otherWallet)) problem = 'The other side cannot be the author'
    else if (!label) problem = 'Label is empty'
    else if (pyLen(label) > 80) problem = 'Label is too long'
    else if (!text) problem = 'Text is empty'
    else if (pyLen(text) > 600) problem = 'Text is too long'
    else if (hasReservedToken(label) || hasReservedToken(text)) problem = 'Text or label contains a reserved token'
    else if (amount === null || amount < 1n || amount > MAX_AMOUNT) problem = 'The amount is out of range'
    else if (openBytes !== null && openBytes > 255) problem = 'Encoded calldata exceeds the proven 255-byte StudioNet path'
    if (problem || amount === null) { setTx({ phase: 'error', label: 'Open bound', message: problem }); return }

    const id = computeBoundId(account, text)
    setTx({ phase: 'wallet', label: 'Open bound', message: 'Checking accepted state before MetaMask…' })
    try {
      if (await readBound(id)) throw new Error('This bound already exists')
      await writeBound({
        account,
        functionName: 'open_bound',
        args: [openForm.otherWallet, label, amount, text],
        onHash: (hash) => setTx({ phase: 'submitted', label: 'Open bound', hash, message: 'Submitted — waiting for explicit execution result.' }),
      })
      setTx({ phase: 'confirmed', label: 'Bound opened', message: `Bound ID: ${id}` })
      remember(id)
      setLookupId(id)
      const state = await loadById(id, true)
      if (state) setLoaded(state)
    } catch (error) { setTx(txError(error, 'Open bound')) }
  }

  async function runWrite(label: string, functionName: 'record_reading' | 'dispute_reading' | 'seal_bound', args: unknown[]) {
    if (!account || !loaded) return false
    setTx({ phase: 'wallet', label, message: 'Waiting for MetaMask…' })
    try {
      await writeBound({
        account,
        functionName,
        args,
        onHash: (hash) => setTx({ phase: 'submitted', label, hash, message: 'Submitted — waiting for explicit execution result.' }),
      })
      const refreshed = await loadById(loaded.record.bound_id, true)
      if (refreshed) setLoaded(refreshed)
      setTx({ phase: 'confirmed', label, message: 'Accepted state refreshed.' })
      return true
    } catch (error) {
      setTx(txError(error, label))
      return false
    }
  }

  async function loadComparison() {
    setCompareError('')
    if (!isBoundId(compareIds.left) || !isBoundId(compareIds.right)) {
      setCompareError('Both sides need a valid 64-character bound ID.')
      return
    }
    const [left, right] = await Promise.all([loadById(compareIds.left, true), loadById(compareIds.right, true)])
    if (!left || !right) { setCompareError('One or both bounds were not found in accepted state.'); return }
    setCompareData({ left, right })
  }

  function useForCompare(side: 'left' | 'right') {
    if (!loaded) return
    setCompareIds((current) => ({ ...current, [side]: loaded.record.bound_id }))
    setCompareData((current) => ({ ...current, [side]: loaded }))
    setActiveTab('compare')
  }

  const comparisonValue = safeBigInt(compareValue)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="WhichWay home"><span className="brand-mark">W?</span><span>WhichWay<small>BoundDirection workspace</small></span></a>
        <nav>
          <button className={activeTab === 'workspace' ? 'active' : ''} onClick={() => setActiveTab('workspace')}>Workspace</button>
          <button className={activeTab === 'compare' ? 'active' : ''} onClick={() => setActiveTab('compare')}>Compare</button>
          <button className={activeTab === 'guide' ? 'active' : ''} onClick={() => setActiveTab('guide')}>How it works</button>
        </nav>
        <button className="wallet" onClick={() => void handleConnect()}>{account ? short(account) : 'Connect MetaMask'}</button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Live on GenLayer StudioNet · Contract does not hold funds</p>
            <h1>One number.<br /><i>Which side</i> is the breach?</h1>
            <p className="hero__lead">Write the obligation once. GenLayer decides whether the number is a floor or a ceiling. Every later reading is judged by that frozen operator, using deterministic arithmetic.</p>
            <div className="hero__actions">
              <button className="primary large" onClick={() => setActiveTab('workspace')}>Open workspace</button>
              <a className="link-button" href={explorer('address', CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">View contract ↗</a>
            </div>
          </div>
          <div className="hero__visual" aria-label="Floor and ceiling illustration">
            <div className="visual-label">SAME NUMBER · OPPOSITE RULE</div>
            <div className="axis"><span>249</span><strong>250</strong><span>251</span></div>
            <div className="rule-row floor"><b>FLOOR</b><span>under 250 is the breach</span><em>249 · BREACH</em></div>
            <div className="rule-row ceiling"><b>CEILING</b><span>over 250 is the breach</span><em>249 · WITHIN</em></div>
          </div>
        </section>

        <section className="contract-strip">
          <div><span>Project</span><strong>WhichWay</strong></div>
          <div><span>Intelligent Contract</span><strong>BoundDirection</strong></div>
          <div><span>Network</span><strong>StudioNet · 61999</strong></div>
          <div><span>Contract</span><strong title={CONTRACT_ADDRESS}>{short(CONTRACT_ADDRESS, 9, 7)}</strong></div>
        </section>

        {tx.phase !== 'idle' && (
          <section className={`tx-banner tx-banner--${tx.phase}`}>
            <div><span>{tx.phase === 'confirmed' ? '✓' : tx.phase === 'error' ? '!' : '…'}</span><div><strong>{tx.label}</strong><p>{tx.message}</p></div></div>
            {tx.hash && <a href={explorer('tx', tx.hash)} target="_blank" rel="noreferrer">Open transaction ↗</a>}
            <button aria-label="Dismiss" onClick={() => setTx(EMPTY_TX)}>×</button>
          </section>
        )}

        {activeTab === 'workspace' && (
          <section className="workspace page-section">
            <div className="section-heading"><p className="eyebrow">01 · Author workflow</p><h2>Create a bound</h2><p>The form is intentionally empty. Nothing here is seeded, mocked or fabricated.</p></div>
            <div className="workspace-grid">
              <form className="form-card" onSubmit={(event) => void submitOpen(event)}>
                <label>Other-side wallet<input value={openForm.otherWallet} onChange={(event) => setOpenForm({ ...openForm, otherWallet: event.target.value })} placeholder="0x…" /></label>
                <label>Other-side label<input value={openForm.label} onChange={(event) => setOpenForm({ ...openForm, label: event.target.value })} placeholder="e.g. the Client" maxLength={80} /><small>{pyLen(openForm.label)}/80 code points</small></label>
                <label>Recorded amount<input inputMode="numeric" value={openForm.amount} onChange={(event) => setOpenForm({ ...openForm, amount: event.target.value })} placeholder="e.g. 250" /></label>
                <label className="span-2">Written obligation<textarea value={openForm.text} onChange={(event) => setOpenForm({ ...openForm, text: event.target.value })} placeholder="Write a clear obligation that makes the amount a floor or a ceiling." maxLength={600} rows={4} /><small>{pyLen(openForm.text)}/600 code points</small></label>
                <div className={`calldata ${openBytes !== null && openBytes > 255 ? 'over' : ''}`}><span>Encoded transaction</span><strong>{openBytes === null ? 'Complete the fields' : `${openBytes} / 255 bytes`}</strong></div>
                <button className="primary span-2" disabled={busy}>Open bound with MetaMask</button>
                <p className="form-note span-2">The direction is resolved once. Ambiguous text fails closed and creates no record.</p>
              </form>

              <div className="load-card">
                <p className="eyebrow">02 · Accepted state</p><h3>Load a bound</h3>
                <label>Bound ID<input value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="64 hexadecimal characters, no 0x" /></label>
                <button className="dark" onClick={() => void loadById(lookupId)}>Load accepted state</button>
                {loadError && <p className="error-text">{loadError}</p>}
                {recentIds.length > 0 && <div className="recent"><span>Recent in this browser</span>{recentIds.map((id) => <button key={id} onClick={() => { setLookupId(id); void loadById(id) }}>{short(id, 10, 8)}</button>)}</div>}
              </div>
            </div>

            {loaded && (
              <div className="loaded-wrap">
                <div className="section-heading compact"><p className="eyebrow">03 · Live ledger</p><h2>Accepted contract state</h2></div>
                <BoundPanel
                  data={loaded}
                  account={account}
                  busy={busy}
                  onRecord={(value) => runWrite('Record reading', 'record_reading', [loaded.record.bound_id, value])}
                  onDispute={(reading, note) => runWrite('Dispute reading', 'dispute_reading', [loaded.record.bound_id, reading.index, note])}
                  onSeal={() => runWrite('Seal bound', 'seal_bound', [loaded.record.bound_id])}
                  onRefresh={async () => { const state = await loadById(loaded.record.bound_id, true); if (state) setLoaded(state) }}
                  onCompare={useForCompare}
                />
              </div>
            )}
          </section>
        )}

        {activeTab === 'compare' && (
          <section className="compare page-section">
            <div className="section-heading"><p className="eyebrow">Deterministic local comparison</p><h2>Same reading. Two operators.</h2><p>This preview uses only the accepted <code>direction</code> and <code>amount</code>. It does not call AI, send a transaction or invoke a preview method on the contract.</p></div>
            <div className="compare-loader">
              <label>Left bound ID<input value={compareIds.left} onChange={(event) => setCompareIds({ ...compareIds, left: event.target.value })} placeholder="Floor bound ID" /></label>
              <label>Right bound ID<input value={compareIds.right} onChange={(event) => setCompareIds({ ...compareIds, right: event.target.value })} placeholder="Ceiling bound ID" /></label>
              <button className="dark" onClick={() => void loadComparison()}>Load both</button>
            </div>
            {compareError && <p className="error-text centered">{compareError}</p>}
            <div className="compare-value"><label>One reading for both<input inputMode="numeric" value={compareValue} onChange={(event) => setCompareValue(event.target.value)} /></label></div>
            <div className="compare-grid">
              {(['left', 'right'] as const).map((side) => {
                const data = compareData[side]
                const verdict = data && comparisonValue !== null ? localVerdict(data.record, comparisonValue) : null
                return (
                  <article className={`compare-card ${verdict ? `compare-card--${verdict.toLowerCase()}` : ''}`} key={side}>
                    <span className="compare-card__side">{side}</span>
                    {data ? <>
                      <span className={`direction direction--${data.record.direction.toLowerCase()}`}>{data.record.direction}</span>
                      <h3>{data.record.other_label}</h3>
                      <blockquote>{data.record.text}</blockquote>
                      <p className="full-operator">{sentenceCase(data.record.operator)}.</p>
                      <div className="big-verdict"><span>{comparisonValue?.toString() || '—'}</span><strong>{verdict || 'ENTER A VALUE'}</strong></div>
                    </> : <div className="compare-empty">Load a bound into this side.</div>}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'guide' && (
          <section className="guide page-section">
            <div className="section-heading"><p className="eyebrow">How it works</p><h2>One semantic decision, then arithmetic.</h2></div>
            <div className="guide-grid">
              <article><span>01</span><h3>Write the obligation</h3><p>The author records the number, the counterparty and the original text in one transaction.</p></article>
              <article><span>02</span><h3>Freeze the direction</h3><p>Validators determine FLOOR or CEILING once. Unsettled text reverts, so no unsafe operator is stored.</p></article>
              <article><span>03</span><h3>Record readings</h3><p>Later values are classified with deterministic <code>&lt;</code> or <code>&gt;</code> arithmetic. Equality is WITHIN.</p></article>
              <article><span>04</span><h3>Keep both voices</h3><p>The named other side may attach one immutable dispute note to each reading, even after sealing.</p></article>
            </div>
            <div className="honest"><h3>What this app does not claim</h3><ul><li>It does not hold money or enforce anything off-chain.</li><li>Readings are author-submitted; the contract does not prove they are true.</li><li>The author names the other wallet; two wallets do not prove two people.</li><li>The text transport path above roughly 150 characters remains less proven than the short test cases.</li></ul></div>
          </section>
        )}
      </main>

      <footer><div><span className="brand-mark small">W?</span><strong>WhichWay</strong></div><p>Built on GenLayer · One semantic call at creation, deterministic forever after.</p><a href={explorer('address', CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Contract ↗</a></footer>
    </div>
  )
}
