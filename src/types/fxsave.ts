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

/** Request for getFxSaveConfig (no params required). */
export interface GetFxSaveConfigRequest {}

/** Result of getFxSaveConfig (fxSAVE protocol totals and config). */
export interface GetFxSaveConfigResult {
  /** Total fxSAVE shares in circulation (wei). */
  totalSupplyWei: bigint
  /** Total assets backing fxSAVE (wei). */
  totalAssetsWei: bigint
  /** Redeem cooldown period in seconds (from FxUSDBasePool). */
  cooldownPeriodSeconds: bigint
  /** Instant redeem fee ratio (wei, from FxUSDBasePool). */
  instantRedeemFeeRatio: bigint
  /** Expense ratio from SavingFxUSD (wei). */
  expenseRatio: bigint
  /** Harvester ratio from SavingFxUSD (wei). */
  harvesterRatio: bigint
  /** Threshold from SavingFxUSD (wei). */
  threshold: bigint
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

/** Request for getFxSaveClaimable (redeem status + preview receive). */
export interface GetFxSaveClaimableRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Preview of what user will receive when claiming (fxUSD + USDC from base pool). */
export interface FxSaveClaimPreviewReceive {
  /** Yield token amount (fxUSD) in wei. */
  amountYieldOutWei: bigint
  /** Stable token amount (USDC) in wei. */
  amountStableOutWei: bigint
}

/** Result of getFxSaveClaimable. */
export interface GetFxSaveClaimableResult extends GetFxSaveRedeemStatusResult {
  /** When hasPendingRedeem, preview of fxUSD + USDC from FxUSDBasePool.previewRedeem (align with app willRedeemReceiveData). */
  previewReceive?: FxSaveClaimPreviewReceive
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

/** Request for depositFxSave. */
export interface FxSaveDepositRequest {
  /** User's wallet address (and receiver). */
  userAddress: string
  /** Input token: usdc, fxUSD, or fxUSDBasePool. */
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
