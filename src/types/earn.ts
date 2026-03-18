import type { FxSaveTx } from './fxsave'

/** Gauge list item returned by API. */
export interface GaugeInfo {
  /** Gauge display name. */
  name: string
  /** Gauge contract address. */
  gauge: string
  /** LP token address. */
  lpAddress: string
}

/** Result of getGaugeList. */
export interface GetGaugeListResult {
  gauges: GaugeInfo[]
}

/** Request for getEarnPosition. */
export interface GetEarnPositionRequest {
  /** User's wallet address. */
  userAddress: string
  /** Gauge contract address. */
  gaugeAddress: string
}

/** Result of getEarnPosition. */
export interface GetEarnPositionResult {
  /** Staked LP balance in the gauge. */
  stakedBalance: bigint
  /** Pending FXN rewards (via TokenMinter). */
  pendingFxn: bigint
  /** Pending extra rewards: tokenAddress -> amount. */
  pendingRewards: Record<string, bigint>
}

/** Request for earnDeposit. */
export interface EarnDepositRequest {
  /** User's wallet address. */
  userAddress: string
  /** Gauge contract address. */
  gaugeAddress: string
  /** LP token address. */
  lpTokenAddress: string
  /** Amount of LP tokens to deposit in wei. */
  amount: bigint
}

/** Result of earnDeposit. */
export interface EarnDepositResult {
  txs: FxSaveTx[]
}

/** Request for earnWithdraw. */
export interface EarnWithdrawRequest {
  /** User's wallet address. */
  userAddress: string
  /** Gauge contract address. */
  gaugeAddress: string
  /** Amount of LP tokens to withdraw in wei. */
  amount: bigint
}

/** Result of earnWithdraw. */
export interface EarnWithdrawResult {
  txs: FxSaveTx[]
}

/** Request for claimFxn. */
export interface ClaimFxnRequest {
  /** User's wallet address. */
  userAddress: string
  /** Gauge contract address. */
  gaugeAddress: string
}

/** Result of claimFxn. */
export interface ClaimFxnResult {
  txs: FxSaveTx[]
}

/** Request for claimRewards. */
export interface ClaimRewardsRequest {
  /** User's wallet address. */
  userAddress: string
  /** Gauge contract address. */
  gaugeAddress: string
  /** Receiver of rewards; defaults to userAddress. */
  receiver?: string
}

/** Result of claimRewards. */
export interface ClaimRewardsResult {
  txs: FxSaveTx[]
}
