# FX SDK — Agent Guide

## Purpose

SDK for **leveraged positions** (long/short) on **ETH** and **BTC**. Amounts are **wei** (bigint); e.g. 1 ETH = `1000000000000000000n`.

## Entry point

```ts
import { FxSdk, tokens } from '@aladdindao/fx-sdk'
const sdk = new FxSdk({ rpcUrl?: string, chainId?: number })
```

Use `tokens` for addresses: `tokens.weth`, `tokens.wstETH`, `tokens.WBTC`, `tokens.fxUSD`, `tokens.usdc`, `tokens.usdt`, `tokens.stETH`, `tokens.eth`.

## Operations (when to use which)

| Operation | When to use |
|-----------|-------------|
| **getPositions** | List positions for market+type (read-only). Use to get `positionId` before other ops. |
| **increasePosition** | Open new (`positionId: 0`) or add to existing. Returns `routes` with `txs`. |
| **reducePosition** | Reduce size or close; `isClosePosition: true` to close fully. |
| **adjustPositionLeverage** | Change leverage of existing position. |
| **depositAndMint** | Long only: deposit collateral, mint fxUSD. |
| **repayAndWithdraw** | Long only: repay fxUSD, withdraw collateral. |

## Markets

- **ETH**: `market: 'ETH'`, `type: 'long'` or `'short'` (wstETH).
- **BTC**: `market: 'BTC'`, `type: 'long'` or `'short'` (WBTC).

## Security and execution

- SDK builds tx payloads only; it does not sign or hold keys. Caller must sign and broadcast each `tx`.
- Nonces are set at build time. Do not reuse built `txs` or mix with other sends from the same address.

## Parameter rules

- **positionId**: `0` = new; `> 0` = existing (caller must own).
- **userAddress**: Valid 0x address.
- **slippage**: Number in (0, 100), e.g. `1` = 1%.
- **amounts**: **bigint** in wei only (no floats/strings).
- **Token addresses**: Prefer `tokens.*`. ETH: eth, stETH, weth, wstETH, usdc, usdt, fxUSD. BTC: WBTC, usdc, usdt, fxUSD.

## Return shapes

- **getPositions**: `[{ positionId, rawColls, rawDebts, currentLeverage, lsdLeverage }]`.
- **increasePosition / reducePosition / adjustPositionLeverage**: `{ positionId?, slippage, routes }`. Each route has `txs`; execute in order. Each `tx`: `type`, `from`, `to`, `data`, `nonce`, optional `value`.
- **depositAndMint / repayAndWithdraw**: `{ txs }`; execute in order.

## Errors

- "Input amount must be greater than 0" / "Amount to reduce must be greater than 0" → positive bigint.
- "Slippage must be between 0 and 100 (exclusive)" → number in (0, 100).
- "... must be a valid Ethereum address" → valid 0x or `tokens.*`.
- "User is not the owner of this position" → caller must own `positionId`; use getPositions.
- "Input/Output/Deposit/Withdraw token address must be ..." → use allowed token for market (see Parameter rules).

## Tool schema

`agent-tools.json` provides JSON Schema for registering SDK methods as tools. Amounts in schema are decimal strings; convert to `bigint` before calling the SDK (e.g. `BigInt(amountWei)`).
