export * from '@/types/pool'
import { ROUTE_TYPES } from '@/core/aggregators'
import { PoolName } from '@/types/pool'

export interface PriceOracle {
  anchorPrice: bigint
  minPrice: bigint
  maxPrice: bigint
}

export interface PositionRequest {
  poolName: PoolName
  positionId: number
  userAddress: string
  slippage: number
  targets?: ROUTE_TYPES[]
}

export interface IncreasePositionRequest extends PositionRequest {
  leverage: number
  inputTokenAddress: string
  amount: bigint
} 

export interface ReducePositionRequest extends PositionRequest {
  amount: bigint
  outputTokenAddress: string
  isClosePosition?: boolean
}

export interface AdjustPositionLeverageRequest extends PositionRequest {
  leverage: number
}

export interface DepositAndMintRequest {
  poolName: PoolName
  positionId: number
  userAddress: string
  depositTokenAddress: string
  depositAmount: bigint
  mintAmount: bigint
}

export interface RepayAndWithdrawRequest {
  poolName: PoolName
  positionId: number
  userAddress: string
  repayAmount: bigint
  withdrawAmount: bigint
  withdrawTokenAddress: string
}

export type ConvertData = {
  encoding: bigint
  routes: string[]
}
