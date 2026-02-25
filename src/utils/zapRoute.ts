import { getRouter } from '@/configs/routers'
import { ConvertData } from '@/types'

/**
 * Gets zap routes for token conversion.
 * @param fromTokenAddress - Source token contract address
 * @param toTokenAddress - Destination token contract address
 * @param isV3 - Optional flag to use V3 router (default: false)
 * @returns Convert data structure with encoding and routes
 * @throws Error if zap route is not found
 */
export const getZapRoutes = ({
  fromTokenAddress,
  toTokenAddress,
  isV3 = false,
}: {
  /** Source token contract address */
  fromTokenAddress: string
  /** Destination token contract address */
  toTokenAddress: string
  /** Optional flag to use V3 router (default: false) */
  isV3?: boolean
}) => {
  const routerData = getRouter(fromTokenAddress, toTokenAddress, isV3)
  if (!routerData.length) {
    throw new Error(
      `No zap route found for ${fromTokenAddress} to ${toTokenAddress}`
    )
  }
  return {
    encoding: routerData[2] || 0n,
    routes: routerData[1],
  } as ConvertData
}
