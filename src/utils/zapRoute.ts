import { getRouter } from '@/configs/routers'

export const getZapRoutes = ({
  fromTokenAddress,
  toTokenAddress,
  isV3 = false,
}: {
  fromTokenAddress: string
  toTokenAddress: string
  isV3?: boolean
}) => {
  const routerData = getRouter(fromTokenAddress, toTokenAddress, isV3)
  if (!routerData.length) {
    throw new Error(
      `Zap route not found for ${fromTokenAddress} to ${toTokenAddress}`
    )
  }
  return {
    encoding: (routerData[2] || 0n) as bigint,
    routes: routerData[1] as string[],
  }
}
