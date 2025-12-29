import { PoolName } from '@/types/pool'
import { Decimal } from 'decimal.js'
import { Market, PositionType } from '@/types'

export { Decimal }

export const cBN = (value: Decimal.Value) => {
  return new Decimal(value)
}

export const getLeverage = (size: Decimal.Value, debt: Decimal.Value) => {
  if (cBN(debt).eq(0)) {
    return 0
  }
  const s = cBN(size)
  return s.div(s.minus(debt)).toNumber()
}

export const getLTV = (rawDebts: Decimal.Value, rawColls: Decimal.Value, anchorPrice: Decimal.Value) => {
  if (rawColls == 0) return 0
  return cBN(rawDebts).div(cBN(anchorPrice).times(rawColls)).toNumber()
}

export const getDebtRatioRange = (
  targetDebtRatio: string,
  slippage: number
) => {
  const minDebtRatio = cBN(targetDebtRatio)
    .times(10000 - slippage)
    .div(10000)
    .toFixed(0, 1)
  const maxDebtRatio = cBN(targetDebtRatio)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  return [minDebtRatio, maxDebtRatio]
}

export const getRangeWithSlippage = (target: string, slippage: number) => {
  const minTarget = cBN(target)
    .times(10000 - slippage)
    .div(10000)
    .toFixed(0, 1)
  const maxTarget = cBN(target)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  return [minTarget, maxTarget]
}

export const getEncodeMiscData = (
  minDebtRatio: string,
  maxDebtRatio: string
) => {
  return cBN(maxDebtRatio).times(cBN(2).pow(60)).plus(minDebtRatio).toFixed(0)
}

export const getEncodeMiscDataWithSlippage = (targetDebtRatio: string, slippage: number) => {
  const [minDebtRatio, maxDebtRatio] = getDebtRatioRange(
    targetDebtRatio,
    slippage
  )

  return getEncodeMiscData(minDebtRatio!, maxDebtRatio!)
}

export const getPoolName = (market: Market, type: PositionType) => {
  if (type !== 'long' && type !== 'short') {
    throw new Error('Invalid type')
  }
  switch (market) {
    case 'ETH':
      return type === 'long' ? PoolName.wstETH : PoolName.wstETH_short
    case 'BTC':
      return type === 'long' ? PoolName.WBTC : PoolName.WBTC_short
    default:
      throw new Error('Invalid market')
  }
}