# Project submission draft

## Project name

`WhichWay`

## Short description

`A GenLayer workspace that freezes whether a recorded number is a floor or ceiling, then audits every later reading with deterministic arithmetic.`

## Changes & improvements (under 1000 characters)

WhichWay turns BoundDirection into a complete two-wallet audit workspace. An author can record a numeric obligation, while GenLayer resolves once whether the number is a FLOOR or CEILING; ambiguous text fails closed and creates no record. Every later reading is classified deterministically, with equality remaining WITHIN. The named other side can attach one immutable dispute note to each reading, including after sealing. The UI exposes the full operator sentence, reading and breach counts, role-aware controls, exact rollback messages, accepted-state refresh, generated bound IDs, calldata size, and transaction Explorer links. Its comparison view loads two real accepted bounds and applies one reading locally, making opposite results visible without another model call or transaction. The contract holds no funds.

## Required links

- Live app: `PASTE_VERCEL_URL_HERE`
- GitHub repository: `PASTE_GITHUB_REPOSITORY_HERE`
- Contract: https://explorer-studio.genlayer.com/address/0xB47fA3bA69E42ef362232C3bBF227588FC78eC5B

## Suggested evidence links after upload

1. GitHub `src/App.tsx`
2. GitHub `src/lib/genlayer.ts`
3. GitHub `TESTING.md`
4. GitHub `contracts/BoundDirection.py`
5. GitHub Actions run
6. Live Vercel app
7. Contract Explorer link above
