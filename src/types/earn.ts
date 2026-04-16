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

/** Gauge base information from GaugeController. */
export interface GaugeBaseInfo {
  /** Total weight across all gauges. */
  total_weight: bigint
  /** Number of gauge types. */
  n_gauge_types: number
  /** FXN token emission rate per second. */
  FXNRate: bigint
  /** List of gauges with their information. */
  GaugeList: GaugeDetailedInfo[]
  /** Type weights for each gauge type. */
  typesWeightDatas: TypeWeightData[]
}

/** Detailed information for a single gauge. */
export interface GaugeDetailedInfo {
  /** Gauge display name. */
  name: string
  /** Gauge contract address. */
  gauge: string
  /** LP token address. */
  lpAddress: string
  /** Gauge type index. */
  gaugeType: number
  /** Token symbol of the gauge. */
  symbol?: string
  /** Total supply of LP tokens staked. */
  totalSupply?: bigint
  /** Current gauge weight. */
  gauge_weight?: bigint
  /** This week's gauge relative weight. */
  this_week_gauge_weight?: bigint
  /** Next week's gauge relative weight. */
  next_week_gauge_weight?: bigint
}

/** Type weight data for a gauge type. */
export interface TypeWeightData {
  /** Weight of this gauge type. */
  type_weight: bigint
  /** Sum of weights for this type. */
  weights_sum_per_type: bigint
}

/** Request for getGaugeApy. */
export interface GetGaugeApyRequest {
  /** Gauge information including weight and TVL data. */
  gaugeInfo: GaugeDetailedInfo
  /** LP token price in USD. */
  lpPrice: number
  /** FXN token price in USD. */
  fxnPrice: number
  /** Gauge base information (weights, rates). */
  baseInfo: GaugeBaseInfo
}

/** Result of getGaugeApy. */
export interface GetGaugeApyResult {
  /** This week's APY as percentage string. */
  thisWeekApy: string
  /** Next week's APY as percentage string. */
  nextWeekApy: string
}
