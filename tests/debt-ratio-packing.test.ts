import { describe, it, expect } from 'vitest'
import {
  getDebtRatioRange,
  getEncodeMiscData,
  getEncodeMiscDataWithSlippage,
} from '../src/utils'
import { DEBT_RATIO_SLIPPAGE } from '../src/configs'

// The router facets read miscData as two uint60 fields:
// decodeUint(0, 60) is the min debt ratio, decodeUint(60, 60) the max.
const UINT60_MAX = (1n << 60n) - 1n
const decode = (miscData: string) => [
  BigInt(miscData) & UINT60_MAX,
  (BigInt(miscData) >> 60n) & UINT60_MAX,
]

describe('getEncodeMiscData', () => {
  it('should pack the debt ratio range without rounding', () => {
    const min = 329949991123456789n
    const max = 336649990923456789n

    expect(decode(getEncodeMiscData(min.toString(), max.toString()))).toEqual([
      min,
      max,
    ])
  })

  it('should keep both fields exact at the uint60 limits', () => {
    expect(decode(getEncodeMiscData('0', UINT60_MAX.toString()))).toEqual([
      0n,
      UINT60_MAX,
    ])
    expect(
      decode(getEncodeMiscData(UINT60_MAX.toString(), UINT60_MAX.toString()))
    ).toEqual([UINT60_MAX, UINT60_MAX])
  })

  it('should encode the slippage range of 2x, 3x and 7x leverage targets', () => {
    for (const target of [
      '500000000000000000',
      '666666666666666666',
      '857142857142857142',
    ]) {
      const [min, max] = getDebtRatioRange(target, DEBT_RATIO_SLIPPAGE)

      expect(
        decode(getEncodeMiscDataWithSlippage(target, DEBT_RATIO_SLIPPAGE))
      ).toEqual([BigInt(min!), BigInt(max!)])
    }
  })
})
