export * from '@/types/pool'
import { ROUTE_TYPES } from '@/core/aggregators'
import { PoolName } from '@/types/pool'

export interface PriceOracle {
  anchorPrice: bigint
  minPrice: bigint
  maxPrice: bigint
}

export interface IncreasePositionRequest {
  poolName: PoolName
  positionId: number
  leverage: number
  fromAmount: bigint
  fromTokenAddress: string
  slippage: number
  targets?: ROUTE_TYPES[]
}
