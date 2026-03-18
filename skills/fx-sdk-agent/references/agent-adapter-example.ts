import { FxSdk, tokens } from '@aladdindao/fx-sdk'
import type { Address } from 'viem'

/** Token key for fxSAVE deposit/withdraw */
export type FxSaveTokenKey = 'usdc' | 'fxUSD' | 'fxUSDBasePool'

/**
 * FxAction: typed discriminated union for all SDK operations.
 *
 * When constructing from agent-tools.json payloads, convert `amountWei` (string)
 * fields to `amount` (bigint) via `BigInt(value)`. The schema uses `*Wei` suffix
 * while SDK/FxAction use the bare field name:
 *   amountWei -> amount, depositAmountWei -> depositAmount, etc.
 */
export type FxAction =
  | {
      kind: 'getPositions'
      userAddress: Address
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
    }
  | {
      kind: 'increasePosition'
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
      positionId: number
      leverage: number
      inputTokenAddress: Address
      amount: bigint
      slippage: number
      userAddress: Address
    }
  | {
      kind: 'reducePosition'
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
      positionId: number
      outputTokenAddress: Address
      amount: bigint
      slippage: number
      userAddress: Address
      isClosePosition?: boolean
    }
  | {
      kind: 'adjustPositionLeverage'
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
      positionId: number
      leverage: number
      slippage: number
      userAddress: Address
    }
  | {
      kind: 'depositAndMint'
      market: 'ETH' | 'BTC'
      positionId: number
      userAddress: Address
      depositTokenAddress: Address
      depositAmount: bigint
      mintAmount: bigint
    }
  | {
      kind: 'repayAndWithdraw'
      market: 'ETH' | 'BTC'
      positionId: number
      userAddress: Address
      repayAmount: bigint
      withdrawAmount: bigint
      withdrawTokenAddress: Address
    }
  | {
      kind: 'getBridgeQuote'
      sourceChainId: 1 | 8453
      destChainId: 1 | 8453
      token: string
      amount: bigint
      recipient: Address
      sourceRpcUrl?: string
    }
  | {
      kind: 'buildBridgeTx'
      sourceChainId: 1 | 8453
      destChainId: 1 | 8453
      token: string
      amount: bigint
      recipient: Address
      refundAddress?: Address
      sourceRpcUrl?: string
    }
  | { kind: 'getFxSaveBalance'; userAddress: Address }
  | { kind: 'getFxSaveRedeemStatus'; userAddress: Address }
  | { kind: 'getFxSaveClaimable'; userAddress: Address }
  | { kind: 'getRedeemTx'; userAddress: Address; receiver?: Address }
  | {
      kind: 'depositFxSave'
      userAddress: Address
      tokenIn: FxSaveTokenKey
      amount: bigint
      slippage?: number
    }
  | {
      kind: 'withdrawFxSave'
      userAddress: Address
      tokenOut: FxSaveTokenKey
      amount: bigint
      instant?: boolean
      slippage?: number
    }
  | { kind: 'getLockInfo'; userAddress: Address }
  | { kind: 'createLock'; userAddress: Address; amount: bigint; unlockTime: number }
  | { kind: 'increaseLockAmount'; userAddress: Address; amount: bigint }
  | { kind: 'extendLockTime'; userAddress: Address; unlockTime: number }
  | { kind: 'withdrawLock'; userAddress: Address }
  | { kind: 'claimLockRewards'; userAddress: Address }
  | {
      kind: 'delegateBoost'
      userAddress: Address
      receiver: Address
      amount: bigint
      endTime: number
    }
  | {
      kind: 'undelegateBoost'
      userAddress: Address
      boostIndex: number
      initialAmount: bigint
    }
  | { kind: 'getGaugeList' }
  | { kind: 'getEarnPosition'; userAddress: Address; gaugeAddress: Address }
  | {
      kind: 'earnDeposit'
      userAddress: Address
      gaugeAddress: Address
      lpTokenAddress: Address
      amount: bigint
    }
  | { kind: 'earnWithdraw'; userAddress: Address; gaugeAddress: Address; amount: bigint }
  | { kind: 'claimFxn'; userAddress: Address; gaugeAddress: Address }
  | { kind: 'claimRewards'; userAddress: Address; gaugeAddress: Address; receiver?: Address }

export interface AdapterOptions {
  rpcUrl?: string
  chainId?: number
  /**
   * When true (default), return the tx plan without executing.
   * Set to false to return an execute_required result with the full tx list.
   * Default: true — callers must explicitly opt in to execution mode.
   */
  planOnly?: boolean
}

export async function runFxAction(action: FxAction, options: AdapterOptions = {}) {
  const chainId = options.chainId ?? 1
  const sdk = new FxSdk({ rpcUrl: options.rpcUrl, chainId })

  if (action.kind === 'getPositions') {
    return sdk.getPositions(action)
  }

  if (action.kind === 'increasePosition') {
    const result = await sdk.increasePosition(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, positionId: result.positionId, routes: result.routes }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send selected route.txs sequentially.',
      routePreview: result.routes[0],
    }
  }

  if (action.kind === 'reducePosition') {
    const result = await sdk.reducePosition(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, positionId: result.positionId, routes: result.routes }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send selected route.txs sequentially.',
      routePreview: result.routes[0],
    }
  }

  if (action.kind === 'adjustPositionLeverage') {
    const result = await sdk.adjustPositionLeverage(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, positionId: result.positionId, routes: result.routes }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send selected route.txs sequentially.',
      routePreview: result.routes[0],
    }
  }

  if (action.kind === 'depositAndMint') {
    const result = await sdk.depositAndMint(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (approve + deposit + mint).',
      txs: result.txs,
    }
  }

  if (action.kind === 'repayAndWithdraw') {
    const result = await sdk.repayAndWithdraw(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (repay + withdraw).',
      txs: result.txs,
    }
  }

  if (action.kind === 'getBridgeQuote') {
    const quote = await sdk.getBridgeQuote({
      sourceChainId: action.sourceChainId,
      destChainId: action.destChainId,
      token: action.token,
      amount: action.amount,
      recipient: action.recipient,
      sourceRpcUrl: action.sourceRpcUrl,
    })
    return { mode: 'plan' as const, quote }
  }

  if (action.kind === 'buildBridgeTx') {
    const result = await sdk.buildBridgeTx({
      sourceChainId: action.sourceChainId,
      destChainId: action.destChainId,
      token: action.token,
      amount: action.amount,
      recipient: action.recipient,
      refundAddress: action.refundAddress,
      sourceRpcUrl: action.sourceRpcUrl,
    })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, tx: result.tx, quote: result.quote }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.tx (to, data, value) on source chain.',
      tx: result.tx,
      quote: result.quote,
    }
  }

  if (action.kind === 'getFxSaveBalance') {
    return sdk.getFxSaveBalance({ userAddress: action.userAddress })
  }

  if (action.kind === 'getFxSaveRedeemStatus') {
    return sdk.getFxSaveRedeemStatus({ userAddress: action.userAddress })
  }

  if (action.kind === 'getFxSaveClaimable') {
    return sdk.getFxSaveClaimable({ userAddress: action.userAddress })
  }

  if (action.kind === 'getRedeemTx') {
    const result = await sdk.getRedeemTx({
      userAddress: action.userAddress,
      receiver: action.receiver,
    })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (claim after cooldown).',
      txs: result.txs,
    }
  }

  if (action.kind === 'depositFxSave') {
    const result = await sdk.depositFxSave({
      userAddress: action.userAddress,
      tokenIn: action.tokenIn,
      amount: action.amount,
      slippage: action.slippage,
    })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (approve then deposit).',
      txs: result.txs,
    }
  }

  if (action.kind === 'withdrawFxSave') {
    const result = await sdk.withdrawFxSave({
      userAddress: action.userAddress,
      tokenOut: action.tokenOut,
      amount: action.amount,
      instant: action.instant,
      slippage: action.slippage,
    })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  // --- Lock (veFXN) ---

  if (action.kind === 'getLockInfo') {
    return sdk.getLockInfo({ userAddress: action.userAddress })
  }

  if (action.kind === 'createLock') {
    const result = await sdk.createLock(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (approve FXN + create_lock).',
      txs: result.txs,
    }
  }

  if (action.kind === 'increaseLockAmount') {
    const result = await sdk.increaseLockAmount(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (approve + increase_amount).',
      txs: result.txs,
    }
  }

  if (action.kind === 'extendLockTime') {
    const result = await sdk.extendLockTime(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  if (action.kind === 'withdrawLock') {
    const result = await sdk.withdrawLock({ userAddress: action.userAddress })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  if (action.kind === 'claimLockRewards') {
    const result = await sdk.claimLockRewards({ userAddress: action.userAddress })
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (FeeDistributor claim).',
      txs: result.txs,
    }
  }

  if (action.kind === 'delegateBoost') {
    const result = await sdk.delegateBoost(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  if (action.kind === 'undelegateBoost') {
    const result = await sdk.undelegateBoost(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  // --- Earn (Gauge LP Mining) ---

  if (action.kind === 'getGaugeList') {
    return sdk.getGaugeList()
  }

  if (action.kind === 'getEarnPosition') {
    return sdk.getEarnPosition({ userAddress: action.userAddress, gaugeAddress: action.gaugeAddress })
  }

  if (action.kind === 'earnDeposit') {
    const result = await sdk.earnDeposit(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (approve LP + deposit).',
      txs: result.txs,
    }
  }

  if (action.kind === 'earnWithdraw') {
    const result = await sdk.earnWithdraw(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  if (action.kind === 'claimFxn') {
    const result = await sdk.claimFxn(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order (TokenMinter.mint).',
      txs: result.txs,
    }
  }

  if (action.kind === 'claimRewards') {
    const result = await sdk.claimRewards(action)
    if (options.planOnly ?? true) {
      return { mode: 'plan' as const, txs: result.txs }
    }
    return {
      mode: 'execute_required' as const,
      message: 'Use wallet client to send result.txs in order.',
      txs: result.txs,
    }
  }

  const _exhaustive: never = action
  throw new Error(`Unsupported action kind: ${(_exhaustive as any).kind}`)
}

// Example payloads for agent planners
export const sampleIncreasePayload: FxAction = {
  kind: 'increasePosition',
  market: 'ETH',
  type: 'short',
  positionId: 0,
  leverage: 3,
  inputTokenAddress: tokens.wstETH as Address,
  amount: 10n ** 17n,
  slippage: 1,
  userAddress: '0x0000000000000000000000000000000000000001',
}

export const sampleDepositFxSavePayload: FxAction = {
  kind: 'depositFxSave',
  userAddress: '0x0000000000000000000000000000000000000001',
  tokenIn: 'usdc',
  amount: 1_000_000n, // 1 USDC (6 decimals)
  slippage: 0.5,
}

export const sampleCreateLockPayload: FxAction = {
  kind: 'createLock',
  userAddress: '0x0000000000000000000000000000000000000001',
  amount: 100n * 10n ** 18n, // 100 FXN
  unlockTime: Math.floor(Date.now() / 1000) + 365 * 86400, // 1 year
}

export const sampleEarnDepositPayload: FxAction = {
  kind: 'earnDeposit',
  userAddress: '0x0000000000000000000000000000000000000001',
  gaugeAddress: '0x0000000000000000000000000000000000000002' as Address, // from getGaugeList
  lpTokenAddress: '0x0000000000000000000000000000000000000003' as Address, // from GaugeInfo.lpAddress
  amount: 10n ** 18n, // 1 LP token
}
