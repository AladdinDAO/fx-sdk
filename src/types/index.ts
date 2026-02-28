export * from '@/types/pool'
export * from '@/types/bridge'
import { ROUTE_TYPES } from '@/core/aggregators'

/** Market type: 'ETH' or 'BTC' */
export type Market = 'ETH' | 'BTC'
/** Position type: 'long' or 'short' */
export type PositionType = 'long' | 'short'

/** Supported token symbols */
export type TokenSymbol = 'ETH' | 'wstETH' | 'stETH' | 'WBTC' | 'USDC' | 'USDT' | 'FXUSD'

/** Price oracle data structure */
export interface PriceOracle {
  /** Anchor price in wei units */
  anchorPrice: bigint
  /** Minimum price in wei units */
  minPrice: bigint
  /** Maximum price in wei units */
  maxPrice: bigint
}

/** Base request interface for position operations */
export interface PositionRequest {
  /** Market type: 'ETH' or 'BTC' */
  market: Market
  /** Position type: 'long' or 'short' */
  type: PositionType
  /** Position ID (0 for new position, > 0 for existing position) */
  positionId: number
  /** User's wallet address */
  userAddress: string
  /** Slippage tolerance as percentage (0-100) */
  slippage: number
  /** Optional array of route types to use */
  targets?: ROUTE_TYPES[]
}

/** Request interface for increasing a position */
export interface IncreasePositionRequest extends PositionRequest {
  /** Leverage multiplier (must be greater than 0) */
  leverage: number
  /** Input token contract address */
  inputTokenAddress: string
  /** Input amount in wei units (bigint) */
  amount: bigint
} 

/** Request interface for reducing a position */
export interface ReducePositionRequest extends PositionRequest {
  /** Amount to reduce in wei units (bigint) */
  amount: bigint
  /** Output token contract address */
  outputTokenAddress: string
  /** Optional flag to fully close the position */
  isClosePosition?: boolean
}

/** Request interface for adjusting position leverage */
export interface AdjustPositionLeverageRequest extends PositionRequest {
  /** Target leverage multiplier (must be greater than 0) */
  leverage: number
}

/** Request interface for depositing collateral and minting fxUSD */
export interface DepositAndMintRequest {
  /** Market type: 'ETH' or 'BTC' (only supports long positions) */
  market: Market
  /** Position ID (0 for new position, > 0 for existing position) */
  positionId: number
  /** User's wallet address */
  userAddress: string
  /** Deposit token contract address */
  depositTokenAddress: string
  /** Amount of collateral to deposit in wei units (bigint) */
  depositAmount: bigint
  /** Amount of fxUSD to mint in wei units (bigint) */
  mintAmount: bigint
}

/** Request interface for repaying debt and withdrawing collateral */
export interface RepayAndWithdrawRequest {
  /** Market type: 'ETH' or 'BTC' (only supports long positions) */
  market: Market
  /** Existing position ID (must be > 0) */
  positionId: number
  /** User's wallet address */
  userAddress: string
  /** Amount of fxUSD to repay in wei units (bigint) */
  repayAmount: bigint
  /** Amount of collateral to withdraw in wei units (bigint) */
  withdrawAmount: bigint
  /** Withdraw token contract address */
  withdrawTokenAddress: string
}

/** Convert data structure for routing */
export type ConvertData = {
  /** Encoding value in wei units */
  encoding: bigint
  /** Array of route addresses */
  routes: string[]
}
