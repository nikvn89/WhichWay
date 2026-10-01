# WhichWay testing

## Fixed deployment

- Project contract: `0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B`
- Explorer: https://explorer-studio.genlayer.com/address/0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B
- Author test wallet: `0x6276095FAEA15108740445ff277fdA8c304657F4`
- Other-side test wallet: `0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE`

These wallets are documentation only. They are not embedded as frontend defaults.

## Automated gates

Run:

```bash
npm run check
```

This covers production TypeScript/build, frozen-source parity, 16 Unicode/Python string-parity cases, exact local ID construction, six FLOOR/CEILING numeric boundaries, malformed address/ID rejection, absence of seeded wallets/mock state, required sealed-state copy, and the ban on `client.connect()`.

### Latest local result — 2026-10-01

- Frontend test groups: **5/5 PASS**
- Python/JavaScript normalization cases: **16/16 PASS**
- Numeric boundary assertions: **6/6 PASS**
- Frozen source SHA-256: **PASS**
- BoundDirection leak gate: **NO LEAK / PASS**
- `tsc -b && vite build`: **exit 0**
- Production preview HTML and JavaScript asset: **HTTP 200**
- Live signed transactions: **7/7 PASS** using the two documented MetaMask wallets on 2026-10-01.

## Verified live run — 2026-10-01

- Bound A (`FLOOR`): `44b5b66e2cf0052efaa829d2c68a840095064f8c72f5208d4d4ea8ee399309dc`
- Bound A reading `250`: `WITHIN`
- Bound A reading `249`: `BREACH`
- Bound A reading #2 dispute: `Source reading is contested.`
- Bound B (`CEILING`): `7be57770e84bbfe679d743114bebca32d218e048e00925e4d0907d26beaefe70`
- Bound B reading `249`: `WITHIN`
- Compare at `249`: Bound A `BREACH`; Bound B `WITHIN`
- Ambiguous position text: request rejected and no third accepted bound created

The wallet/RPC path shortened the ambiguous rollback to `The request could not be completed.` The fail-closed result was verified by the absence of a third bound in accepted state; the frontend does not substitute a fabricated contract reason.

## Seven frontend transactions

Run in this order after deploying the exact frozen source. Save every transaction hash shown by the UI.

| # | Wallet | UI action | Exact input | Expected accepted result |
|---|---|---|---|---|
| 1 | Author | Open bound A | Other wallet above; label `the Client`; amount `250`; text `The agreed figure is the least we will provide.` | `Direction: FLOOR`; save bound A ID |
| 2 | Author | Record reading | Bound A, `250` | `WITHIN` |
| 3 | Author | Record reading | Bound A, `249` | `BREACH` |
| 4 | Other side | Dispute reading | Bound A, index `2`; note `Source reading is contested.` | Note appears beside reading #2 |
| 5 | Author | Open bound B | Same other wallet/label/amount; text `The agreed figure is the most we will provide.` | `Direction: CEILING`; save bound B ID |
| 6 | Author | Record reading | Bound B, `249` | `WITHIN` |
| 7 | Author | Open ambiguous bound | amount `250`; text `The agreed figure applies to this work.` | Revert: `The direction of the bound could not be read from the text`; no record |

## Three screenshots

1. Compare mode with bound A and B, reading `249`: one red `BREACH`, one green `WITHIN`, with both full operator sentences visible.
2. Bound A ledger showing `250 → WITHIN`, `249 → BREACH`, and the other-side note on row #2.
3. The ambiguous open-bound failure banner with the original input visible and only the two valid IDs present; no third accepted bound is created.

## What this run does not prove

- It does not prove that submitted numeric readings are truthful.
- It does not prove two wallets belong to different people.
- It does not prove every 600-character contract-valid text can traverse the current Studio RPC transport.
- It does not turn Compare into contract evidence; Compare is explicitly local deterministic arithmetic over accepted state.
