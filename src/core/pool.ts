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

  constructor({ poolName }: { poolName: PoolName }) {
    this.config = pools[poolName]
    this.price = new Price({ pool: this })
  }

  getPoolManagerAddress() {
    return this.config.isShort
      ? contracts.ShortPoolManager
      : contracts.PoolManager
  }

  getPoolManagerAbi() {
    return this.config.isShort ? ShortPoolManagerAbi : PoolManagerAbi
  }

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
        { result: [bigint, bigint, bigint, bigint] }
      ]

      return {
        collateralCapacity: poolInfoRes[0],
        collateralBalance: poolInfoRes[1],
        rawCollateral: poolInfoRes[2],
        debtCapacity: poolInfoRes[3],
        debtBalance: poolInfoRes[4] || 0n,

        isPaused: pausedRes,

        poolMinDebtRatio: debtRatioRangeRes[0],
        poolMaxDebtRatio: debtRatioRangeRes[1],

        supplyFeeRatio: poolFeeRatioRes[0],
        withdrawFeeRatio: poolFeeRatioRes[1],
        repayFeeRatio: fxMintPoolFeeRatioRes[3],
      }
    } catch (error) {
      throw new Error('Failed to get pool info')
    }
  }

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

    console.log('poolData-->', poolData)

    const poolInfo = {
      ...this.config,
      ...poolData,
      ...oraclePrice,
      collRest: poolData.collateralCapacity - poolData.collateralBalance,
      debtRest: poolData.debtCapacity - poolData.debtBalance,
      rateRes,

      averagePrice,
      openPrice: isShort ? sellPrice : buyPrice,
      closePrice: isShort ? buyPrice : sellPrice,

      openFeeRatio: cBN(poolData.supplyFeeRatio ?? 0)
        .div(1e9)
        .toNumber(),
      closeFeeRatio: cBN(poolData.withdrawFeeRatio ?? 0)
        .div(1e9)
        .toNumber(),
      repayFeeRatio: cBN(poolData.repayFeeRatio ?? 0)
        .div(1e9)
        .toNumber(),
    }

    console.log('poolInfo-->', poolInfo)

    return poolInfo
  }
}
