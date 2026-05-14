import { pools } from '@/configs/pools'
import { PoolConfig, PoolInfo, PoolName } from '@/types'
import { batchedMulticall, MulticallContractCall } from '@/utils/multicall'
import PoolManagerAbi from '@/abis/PoolManager.json'
import ShortPoolManagerAbi from '@/abis/ShortPoolManager.json'
import PoolAbi from '@/abis/AFPool.json'
import PoolConfigurationAbi from '@/abis/PoolConfiguration.json'
import { contracts } from '@/configs/contracts'
import { Price } from '@/core/price'
import { cBN } from '@/utils'
import { getClient } from '@/core/client'

export class Pool {
  readonly config: PoolConfig
  readonly price: Price

  /**
   * Creates a new Pool instance.
   * @param poolName - Pool identifier (e.g. wstETH, WBTC, wstETH_short, WBTC_short)
   */
  constructor({ poolName }: { /** Pool identifier */ poolName: PoolName }) {
    this.config = pools[poolName]
    this.price = new Price({ pool: this })
  }

  /**
   * Gets the pool manager contract address.
   * @returns Pool manager contract address
   */
  getPoolManagerAddress() {
    return this.config.isShort
      ? contracts.ShortPoolManager
      : contracts.PoolManager
  }

  /**
   * Gets the pool manager ABI.
   * @returns Pool manager ABI
   */
  getPoolManagerAbi() {
    return this.config.isShort ? ShortPoolManagerAbi : PoolManagerAbi
  }

  /**
   * Fetches the on-chain numbers needed for both leverage trading and fxMINT
   * core ops: capacities, debt-ratio range, paused flag, and both fee tuples
   * (Router_Diamond for leverage trading, FxMintRouter for fxMINT).
   */
  async getPoolData() {
    const calls = [
      {
        address: this.getPoolManagerAddress(),
        abi: this.getPoolManagerAbi(),
        functionName: 'getPoolInfo',
        args: [this.config.poolAddress],
      },
      {
        address: this.getPoolManagerAddress(),
        abi: this.getPoolManagerAbi(),
        functionName: 'paused',
      },
      {
        address: this.config.poolAddress,
        abi: PoolAbi,
        functionName: 'getDebtRatioRange',
      },
      {
        address: contracts.PoolConfiguration,
        abi: PoolConfigurationAbi,
        functionName: 'getPoolFeeRatio',
        args: [this.config.poolAddress, contracts.Router_Diamond],
      },
      {
        address: contracts.PoolConfiguration,
        abi: PoolConfigurationAbi,
        functionName: 'getPoolFeeRatio',
        args: [this.config.poolAddress, contracts.FxMintRouter],
      },
    ]

    try {
      const [
        { result: poolInfoRes },
        { result: pausedRes },
        { result: debtRatioRangeRes },
        { result: poolFeeRatioRes },
        { result: fxMintPoolFeeRatioRes },
      ] = (await batchedMulticall(
        getClient(),
        calls as MulticallContractCall[]
      )) as [
        { result: [bigint, bigint, bigint, bigint, bigint] },
        { result: boolean },
        { result: [bigint, bigint] },
        { result: [bigint, bigint, bigint, bigint] },
        { result: [bigint, bigint, bigint, bigint] },
      ]

      const { isShort } = this.config

      return {
        collateralCapacity: poolInfoRes[0],
        collateralBalance: poolInfoRes[1],
        rawCollateral: isShort ? 0n : poolInfoRes[2],
        debtCapacity: isShort ? poolInfoRes[2] : poolInfoRes[3],
        debtBalance: isShort ? poolInfoRes[3] : poolInfoRes[4],

        isPaused: pausedRes,

        poolMinDebtRatio: debtRatioRangeRes[0],
        poolMaxDebtRatio: debtRatioRangeRes[1],

        supplyFeeRatio: poolFeeRatioRes[0],
        withdrawFeeRatio: poolFeeRatioRes[1],
        borrowFeeRatioRaw: fxMintPoolFeeRatioRes[2],
        repayFeeRatioRaw: fxMintPoolFeeRatioRes[3],
      }
    } catch (error) {
      throw new Error('Failed to fetch pool data')
    }
  }

  /**
   * Gets pool information needed by both leverage trading and fxMINT core ops:
   * capacities, debt-ratio range, fee ratios (including `borrowFeeRatio` /
   * `repayFeeRatio` used by fxMINT), and price data.
   */
  async getPoolInfo(): Promise<PoolInfo> {
    const { isShort } = this.config

    const poolData = await this.getPoolData()
    const rateRes = await this.price.getRateRes()
    const oraclePrice = await this.price.getOraclePrice()

    const buyPrice = cBN(await this.price.getBuyPrice())
      .times(1e18)
      .div(rateRes)
      .toString()
    const sellPrice = cBN(await this.price.getSellPrice())
      .times(1e18)
      .div(rateRes)
      .toString()
    const averagePrice = cBN(buyPrice).add(cBN(sellPrice)).div(2).toString()

    const poolInfo: PoolInfo = {
      ...this.config,

      collateralCapacity: poolData.collateralCapacity,
      collateralBalance: poolData.collateralBalance,
      rawCollateral: poolData.rawCollateral,
      debtCapacity: poolData.debtCapacity,
      debtBalance: poolData.debtBalance,

      isPaused: poolData.isPaused,

      ...oraclePrice,

      collRest: poolData.collateralCapacity - poolData.collateralBalance,
      debtRest: poolData.debtCapacity - poolData.debtBalance,
      rateRes,

      averagePrice,
      openPrice: isShort ? sellPrice : buyPrice,
      closePrice: isShort ? buyPrice : sellPrice,

      poolMinDebtRatio: poolData.poolMinDebtRatio,
      poolMaxDebtRatio: poolData.poolMaxDebtRatio,

      openFeeRatio: cBN(poolData.supplyFeeRatio ?? 0)
        .div(1e9)
        .toNumber(),
      closeFeeRatio: cBN(poolData.withdrawFeeRatio ?? 0)
        .div(1e9)
        .toNumber(),
      borrowFeeRatio: cBN(poolData.borrowFeeRatioRaw ?? 0)
        .div(1e9)
        .toNumber(),
      repayFeeRatio: cBN(poolData.repayFeeRatioRaw ?? 0)
        .div(1e9)
        .toNumber(),
    }

    return poolInfo
  }
}
