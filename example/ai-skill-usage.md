# AI Skill Usage Example

This document shows how to ask an AI agent to use the local `fx-sdk-agent` skill.

Skill path:
- `skills/fx-sdk-agent/SKILL.md`

## Example 1: Read-Only Query

Use this prompt:

```text
Use the fx-sdk-agent skill to query all ETH long positions for address 0xYourAddress.
Return JSON with positionId, rawColls, rawDebts, currentLeverage, and lsdLeverage.
```

Expected behavior:
- Agent calls `sdk.getPositions({ userAddress, market: 'ETH', type: 'long' })`
- Agent returns structured results without sending transactions

## Example 2: Plan-Only Increase Position

Use this prompt:

```text
Use the fx-sdk-agent skill to generate a planOnly increasePosition flow and do not send transactions.
Parameters:
- market: ETH
- type: short
- positionId: 0
- leverage: 3
- inputTokenAddress: tokens.wstETH
- amount: 100000000000000000n
- slippage: 1
- userAddress: 0xYourAddress
Return key fields from routes[0] and the txs list.
```

Expected behavior:
- Agent generates SDK code for `increasePosition`
- Agent only returns route plan (`routes`, `txs`, leverage, executionPrice)
- Agent does not execute wallet transactions

## Example 3: Generate Sequential Execution Code

Use this prompt:

```text
Use the fx-sdk-agent skill to generate viem execution code from the increasePosition result.
Requirements:
- Send transactions in tx.nonce order
- Wait for receipt after each transaction
- Keep retry/error logging
```

Expected behavior:
- Agent generates `walletClient.sendTransaction(...)` loop
- Agent keeps SDK-generated nonce order
- Agent includes receipt waiting logic

## Verification Checklist

1. Confirm AI output uses `FxSdk` from `fx-sdk`.
2. Confirm token/market combinations are valid.
3. Confirm slippage is in `(0, 100)`.
4. Confirm route planning and transaction sending are separate phases.
5. Confirm execution code sends `txs` sequentially.
