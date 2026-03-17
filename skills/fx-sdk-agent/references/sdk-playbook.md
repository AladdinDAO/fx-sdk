# FX SDK Playbook

Reference for request shapes, minimal code snippets, and validation. See `AGENTS.md` for when to use each operation.

## Minimal Read-Only Example

```ts
import { FxSdk } from '@aladdindao/fx-sdk'

const sdk = new FxSdk({ rpcUrl: process.env.RPC_URL, chainId: 1 })

const positions = await sdk.getPositions({
  userAddress,
  market: 'ETH',
  type: 'long',
})
// positions: PositionInfo[] (positionId, rawColls, rawDebts, currentLeverage, lsdLeverage, rawCollsToken, rawDebtsToken, rawCollsDecimals, rawDebtsDecimals)
```

## Minimal Transaction Planning Example

```ts
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

const sdk = new FxSdk({ rpcUrl: process.env.RPC_URL, chainId: 1 })

const result = await sdk.increasePosition({
  market: 'ETH',
  type: 'short',
  positionId: 0,
  leverage: 3,
  inputTokenAddress: tokens.wstETH,
  amount: 10n ** 17n,
  slippage: 1,
  userAddress,
})

const route = result.routes[0]
```

## Sequential Execution Example

```ts
for (const tx of route.txs) {
  const hash = await walletClient.sendTransaction({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: tx.value || 0n,
    nonce: tx.nonce,
  })
  await publicClient.waitForTransactionReceipt({ hash })
}
```

## Request Templates

### Get Positions

```ts
{ userAddress: string, market: 'ETH' | 'BTC', type: 'long' | 'short' }
```

### Increase Position

```ts
{
  market: 'ETH' | 'BTC',
  type: 'long' | 'short',
  positionId: number,
  leverage: number,
  inputTokenAddress: string,
  amount: bigint,
  slippage: number,
  userAddress: string,
  targets?: ROUTE_TYPES[],
}
```

### Reduce Position

```ts
{
  market: 'ETH' | 'BTC',
  type: 'long' | 'short',
  positionId: number,
  outputTokenAddress: string,
  amount: bigint,
  slippage: number,
  userAddress: string,
  isClosePosition?: boolean,
}
```

### Adjust Position Leverage

```ts
{
  market: 'ETH' | 'BTC',
  type: 'long' | 'short',
  positionId: number,
  leverage: number,
  slippage: number,
  userAddress: string,
}
```

### Deposit And Mint (Long Only)

```ts
{
  market: 'ETH' | 'BTC',
  positionId: number,
  depositTokenAddress: string,
  depositAmount: bigint,
  mintAmount: bigint,
  userAddress: string,
}
```

### Repay And Withdraw (Long Only)

```ts
{
  market: 'ETH' | 'BTC',
  positionId: number,
  repayAmount: bigint,
  withdrawAmount: bigint,
  withdrawTokenAddress: string,
  userAddress: string,
}
```

### Bridge (Base <-> Ethereum)

```ts
// Quote
{ sourceChainId: 1 | 8453, destChainId: 1 | 8453, token: string, amount: bigint, recipient: string, sourceRpcUrl?: string }
// Build tx
{ ...quote, refundAddress?: string }
```

### fxSAVE — Config (totals & cooldown)

```ts
// No params required
sdk.getFxSaveConfig()
// → { totalSupplyWei, totalAssetsWei, cooldownPeriodSeconds, instantRedeemFeeRatio, expenseRatio, harvesterRatio, threshold } (all bigint wei)
```

### fxSAVE — Balance

```ts
{ userAddress: string }
// → { balanceWei: bigint, assetsWei?: bigint }
```

### fxSAVE — Redeem Status (Cooldown)

```ts
{ userAddress: string }
// → { hasPendingRedeem, pendingSharesWei, cooldownPeriodSeconds, redeemableAt, isCooldownComplete }
```

### fxSAVE — Claimable (Status + Preview Receive)

```ts
{ userAddress: string }
// → redeem status + optional previewReceive: { amountYieldOutWei, amountStableOutWei }
```

### fxSAVE — Get Redeem Tx (Claim after cooldown)

```ts
{ userAddress: string, receiver?: string }
// → { txs } when isCooldownComplete; else throws
```

### fxSAVE — Deposit

```ts
{
  userAddress: string,
  tokenIn: 'usdc' | 'fxUSD' | 'fxUSDBasePool',
  amount: bigint,
  slippage?: number,
}
// → { txs }; execute in order (approve then deposit)
```

### fxSAVE — Withdraw

```ts
{
  userAddress: string,
  tokenOut: 'usdc' | 'fxUSD' | 'fxUSDBasePool',
  amount: bigint,  // fxSAVE shares wei
  instant?: boolean,
  slippage?: number,  // required when instant is true
}
// → { txs }; fxUSDBasePool → redeem; usdc/fxUSD !instant → requestRedeem; usdc/fxUSD instant → approve + instantRedeemFromFxSave
```

### Lock — Get Lock Info

```ts
{ userAddress: string }
// → { lockedAmount, lockEnd, vePower, lockStatus, veTotalSupply, pendingWstETH, delegatedBalance, delegableBalance, adjustedVeBalance, weeklyFeeAmount }
```

### Lock — Create Lock

```ts
{
  userAddress: string,
  amount: bigint,       // FXN wei
  unlockTime: number,   // unix timestamp; auto-aligned to WEEK (604800s), max 4 years
}
// → { txs } (approve FXN + create_lock)
```

### Lock — Increase Lock Amount

```ts
{
  userAddress: string,
  amount: bigint,  // additional FXN wei
}
// → { txs } (approve + increase_amount)
```

### Lock — Extend Lock Time

```ts
{
  userAddress: string,
  unlockTime: number,  // must be > current lockEnd
}
// → { txs }
```

### Lock — Withdraw Lock

```ts
{ userAddress: string }
// → { txs }; only when lockStatus is 'expired'
```

### Lock — Claim Lock Rewards

```ts
{ userAddress: string }
// → { txs } (FeeDistributor.claim → wstETH)
```

### Lock — Delegate Boost

```ts
{
  userAddress: string,
  receiver: string,
  amount: bigint,    // veFXN amount to delegate
  endTime: number,   // delegation end timestamp
}
// → { txs }
```

### Lock — Undelegate Boost

```ts
{
  userAddress: string,
  boostIndex: number,      // token index
  initialAmount: bigint,   // original delegated amount (uint128)
}
// → { txs }
```

### Earn — Get Gauge List

```ts
// No params required
sdk.getGaugeList()
// → { gauges: [{ name, gauge, lpAddress }] }
```

### Earn — Get Earn Position

```ts
{ userAddress: string, gaugeAddress: string }
// → { stakedBalance, pendingFxn, pendingRewards }
```

### Earn — Deposit

```ts
{
  userAddress: string,
  gaugeAddress: string,
  lpTokenAddress: string,
  amount: bigint,  // LP token wei
}
// → { txs } (approve LP + gauge.deposit)
```

### Earn — Withdraw

```ts
{
  userAddress: string,
  gaugeAddress: string,
  amount: bigint,
}
// → { txs }
```

### Earn — Claim FXN

```ts
{ userAddress: string, gaugeAddress: string }
// → { txs } (TokenMinter.mint(gauge))
```

### Earn — Claim Rewards

```ts
{
  userAddress: string,
  gaugeAddress: string,
  receiver?: string,  // defaults to userAddress
}
// → { txs }
```

## Validation Checklist

1. **Types and tests**
   - `npm test` or `pnpm test`

2. **Examples (set `example/.env` first)**
   - Positions: `npm run example:positions`
   - Increase: `npm run example:increase`
   - Reduce: `npm run example:reduce`
   - Adjust: `npm run example:adjust`
   - Deposit and mint: `npm run example:deposit`
   - Repay and withdraw: `npm run example:repay`
   - Bridge: `npm run example:bridge`
  - fxSAVE balance: `npm run example:fxsave-balance`
  - fxSAVE config: `npm run example:fxsave-config`
  - fxSAVE deposit: `npm run example:fxsave-deposit`
   - fxSAVE withdraw: `npm run example:fxsave-withdraw`
   - fxSAVE claim: `npm run example:fxsave-claim`
   - Lock info: `npm run example:lock-info`
   - Lock create: `npm run example:lock-create`
   - Earn gauge list: `npm run example:earn-gauge-list`
   - Earn deposit: `npm run example:earn-deposit`
   - Earn withdraw: `npm run example:earn-withdraw`
   - Earn claim FXN: `npm run example:earn-claim-fxn`
   - Earn claim rewards: `npm run example:earn-claim-rewards`

3. **Tx ordering**
   - Approve tx first (if present)
   - Main tx last
   - Nonces strictly increasing

4. **Inputs**
   - Token-market compatibility (see AGENTS.md Parameter rules)
   - Slippage in (0, 100)
   - Amounts as bigint wei; from agent-tools convert strings with `BigInt(value)`
