import { Pool } from '@/core/pool'
import { contracts } from '@/configs/contracts'
import RateProviderAbi from '@/abis/RateProvider.json'
import { PoolName } from '@/types'
import PriceOracleAbi from '@/abis/PriceOracle.json'
import { getQuote, ROUTE_TYPES } from '@/core/aggregators'
import { cBN } from '@/utils'
import { getClient } from '@/core/client'
import { tokens } from '@/configs/tokens'

export class Price {
  private pool: Pool

  constructor({ pool }: { pool: Pool }) {
    this.pool = pool
  }

  async getRateRes() {
    const rateRes = (await getClient().readContract({
      address: contracts.IRateProvider as `0x${string}`,
      abi: RateProviderAbi,
      functionName: 'getRate',
    })) as bigint

    if (this.pool.config.poolName.includes(PoolName.wstETH)) {
      return rateRes
    }
    return BigInt(1e18)
  }

  async getOraclePrice() {
    const oraclePrice = await getClient().readContract({
      address: this.pool.config.oracle as `0x${string}`,
      abi: PriceOracleAbi,
      functionName: 'getPrice',
    })
    if (!Array.isArray(oraclePrice)) {
      throw new Error('Unexpected result from getPrice')
    }
    return {
      anchorPrice: oraclePrice[0],
      minPrice: oraclePrice[1],
      maxPrice: oraclePrice[2],
    }
  }

  async getBuyPrice() {
    const fxUSDAmount = 1e20
    const { isShort, deltaDebtAddress, deltaCollAddress, precision } =
      this.pool.config
    const quote = await getQuote({
      src: tokens.fxUSD,
      dst: isShort ? deltaDebtAddress : deltaCollAddress,
      amount: BigInt(fxUSDAmount),
      targets: [ROUTE_TYPES.FX_ROUTE],
    })

    const { best, amounts } = quote

    const { dst } = amounts[best]

    return cBN(fxUSDAmount).div(dst).div(1e18).times(precision).toString()
  }

  async getSellPrice() {
    const AmountMap = {
      wstETH: 1e16, // Use 0.01 wstETH as baseline
      WETH: 1e16, // Use 0.01 WETH as baseline
      WBTC: 10000, // Use 0.001 WBTC as baseline
    }

    const {
      isShort,
      deltaCollSymbol,
      deltaDebtSymbol,
      deltaDebtAddress,
      deltaCollAddress,
      precision,
    } = this.pool.config

    const amount =
      AmountMap[
        (isShort ? deltaDebtSymbol : deltaCollSymbol) as keyof typeof AmountMap
      ]

    const quote = await getQuote({
      src: isShort ? deltaDebtAddress : deltaCollAddress,
      dst: tokens.fxUSD,
      amount: BigInt(amount),
      targets: [ROUTE_TYPES.FX_ROUTE],
    })

    const { best, amounts } = quote

    const { dst } = amounts[best]

    return cBN(dst).div(amount).div(1e18).times(precision).toString()
  }
}
