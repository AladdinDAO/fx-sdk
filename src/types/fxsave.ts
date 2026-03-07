/** Single tx payload for fxSAVE (same shape as depositAndMint txs). */
export interface FxSaveTx {
  type?: string
  from: string
  to: string
  data: string
  value?: bigint
  nonce?: number
  chainId?: number
}

/** Request for getFxSaveBalance. */
export interface GetFxSaveBalanceRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Result of getFxSaveBalance. */
export interface GetFxSaveBalanceResult {
  /** User's fxSAVE balance in wei (shares). */
  balanceWei: bigint
  /** Equivalent assets in wei (convertToAssets), if available. */
  assetsWei?: bigint
}

/** Request for getFxSaveRedeemStatus (Cooldown state). */
export interface GetFxSaveRedeemStatusRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Result of getFxSaveRedeemStatus. */
export interface GetFxSaveRedeemStatusResult {
  /** Whether there is a pending redeem request. */
  hasPendingRedeem: boolean
  /** Pending redeem shares in wei. */
  pendingSharesWei: bigint
  /** Cooldown period in seconds. */
  cooldownPeriodSeconds: bigint
  /** Unix timestamp when redeem becomes available; null if no pending redeem. */
  redeemableAt: number | null
  /** True when cooldown has passed and user can call redeem. */
  isCooldownComplete: boolean
}

/** Request for getRedeemTx (after cooldown). */
export interface GetRedeemTxRequest {
  /** User's wallet address. */
  userAddress: string
  /** Receiver of redeemed assets; defaults to userAddress. */
  receiver?: string
}

/** Result of getRedeemTx. */
export interface GetRedeemTxResult {
  txs: FxSaveTx[]
}

/** Supported token for fxSAVE deposit/withdraw: usdc, fxUSD, fxUSDBasePool (Stability Pool share). */
export type FxSaveTokenIn =
  | 'usdc'
  | 'fxUSD'
  | 'fxUSDBasePool'
  | 'gaugeUSDCfxUSD'

/** Request for depositFxSave. */
export interface FxSaveDepositRequest {
  /** User's wallet address (and receiver). */
  userAddress: string
  /** Input token: usdc, fxUSD, fxUSDBasePool, or gaugeUSDCfxUSD. */
  tokenIn: FxSaveTokenIn
  /** Amount in wei (token's smallest unit). */
  amount: bigint
  /** Slippage tolerance (0–100 exclusive); used when tokenIn is usdc/fxUSD. */
  slippage?: number
}

/** Result of depositFxSave. */
export interface FxSaveDepositResult {
  txs: FxSaveTx[]
}

/** Request for withdrawFxSave. */
export interface FxSaveWithdrawRequest {
  /** User's wallet address (and receiver for default redeem). */
  userAddress: string
  /** Output token: usdc, fxUSD, or fxUSDBasePool. */
  tokenOut: FxSaveTokenIn
  /** fxSAVE shares to redeem in wei. */
  amount: bigint
  /** If true, instant redeem (fee + slippage); only for usdc/fxUSD. */
  instant?: boolean
  /** Slippage (0–100); required when instant is true. */
  slippage?: number
}

/** Result of withdrawFxSave. */
export interface FxSaveWithdrawResult {
  txs: FxSaveTx[]
}
