# WhichWay

WhichWay does not ask whether a number is good enough, and it does not grade anything on a scale. The number is already on the record. It asks which side of that number the author is not allowed to be on, and turns that answer into the comparison operator every later reading is judged by.

**WhichWay** is the Project/dApp. **BoundDirection** is the frozen GenLayer Intelligent Contract underneath it.

- Network: GenLayer StudioNet (`61999`)
- Contract: [`0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B`](https://explorer-studio.genlayer.com/address/0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B)
- SDK: `genlayer-js 1.1.8`
- Frozen source SHA-256: `9aef694bb65c030ca2981a47110bd0f446db0422f62ad7d2e60e3ffa5e39ed42`

## What the app makes visible

1. An author records a number, a named other-side wallet and the original text.
2. GenLayer resolves the text once as a `FLOOR` or `CEILING`. Ambiguous output reverts and creates no record.
3. Later readings use deterministic arithmetic only: below a floor or above a ceiling is `BREACH`; equality is `WITHIN`.
4. The named other side may add one immutable dispute note per reading, including after the bound is sealed.
5. Compare mode puts two accepted bounds side by side and applies one reading locally. It calls no AI and sends no transaction.

## Run locally

```bash
npm install
npm run check
npm run dev
```

Open the local URL, connect MetaMask and switch to GenLayer StudioNet when prompted. The app does not call `client.connect()` and does not require the optional GenLayer Snap. Vite proxies `/genlayer-rpc` to StudioNet; `vercel.json` provides the same proxy in production.

## How to try it

Use two wallets to exercise the complete workflow. The form deliberately starts empty.

1. Connect the author wallet and open a floor bound with amount `250` and text: `The agreed figure is the least we will provide.`
2. Record `250`, then `249`. They should be `WITHIN`, then `BREACH`.
3. Copy the generated bound ID, switch to the named other-side wallet and dispute reading `#2`.
4. Switch back to the author wallet and open a ceiling bound with the same amount and text: `The agreed figure is the most we will provide.`
5. Record `249`; it should be `WITHIN`.
6. Load both IDs in Compare, enter `249`, and observe opposite results produced from accepted contract state.
7. Submit `The agreed figure applies to this work.` as a new bound. The transaction should fail closed with `The direction of the bound could not be read from the text`, and the computed ID should not resolve to a record.

## Safety and honest limitations

- The contract holds no money and does not enforce anything off-chain.
- Readings are author-submitted; the contract does not prove they are true.
- A wrongly resolved direction would silently judge later readings backwards. Mitigations are the three-outcome rubric with fail-closed behavior, the visible full operator line, and immutable per-reading disputes.
- `NOT_SETTLED` intentionally costs a transaction without creating a record. Ambiguity gives the author no usable operator.
- The author chooses the other-side wallet. Two wallets do not prove two different people.
- `MAX_READINGS` is 30 and `MAX_AMOUNT` is `10**18`; an open bound at capacity does not automatically become sealed.
- Short proof cases stay below the known Studio transport boundary. The contract accepts longer text, but the path above roughly 150 characters is less proven.

## Repository checks

- `npm test`: Unicode/Python normalization parity, ID construction, six numeric boundaries, validation and anti-mock UI gates.
- `npm run verify:source`: verifies that the included contract matches the frozen deployed source.
- `npm run build`: TypeScript project build followed by the production Vite bundle.

See [TESTING.md](./TESTING.md) for the exact two-wallet runtime plan.
