import { Decimal } from 'decimal.js'

export { Decimal }

export const cBN = (value: Decimal.Value) => {
  return new Decimal(value)
}

export const getLeverage = (size: Decimal.Value, debt: Decimal.Value) => {
  try {
    const s = cBN(size)
    return s.div(s.minus(debt)).toNumber()
  } catch (error) {
    return 0
  }
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
  return cBN(maxDebtRatio).times(cBN(2).pow(60)).plus(minDebtRatio).toString()
}
