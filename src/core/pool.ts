import { pools } from '@/configs/pools'
import { PoolConfig, PoolInfo, PoolName } from '@/types'
import { batchedMulticall, MulticallContractCall } from '@/utils/multicall'
import PoolManagerAbi from '@/abis/PoolManager.json'
import ShortPoolManagerAbi from '@/abis/ShortPoolManager.json'
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

  isShort() {
    return this.config.isShort
  }

  isLong() {
    return !this.isShort()
  }

  getPoolAddress() {
    return this.config.poolAddress
  }

  getPoolManagerAddress() {
    return this.isShort() ? contracts.ShortPoolManager : contracts.PoolManager
  }

  getPoolManagerAbi() {
    return this.isShort() ? ShortPoolManagerAbi : PoolManagerAbi
  }

  async getPoolData() {
    const calls = [
      {
        address: this.getPoolManagerAddress(),
        abi: this.getPoolManagerAbi(),
        functionName: 'getPoolInfo',
        args: [this.getPoolAddress()],
      },
      {
        address: this.getPoolManagerAddress(),
        abi: this.getPoolManagerAbi(),
        functionName: 'paused',
      },
    ]

    try {
      const [poolInfoResponse, pausedResponse] = (await batchedMulticall(
        getClient(),
        calls as MulticallContractCall[]
      )) as [{ result: bigint[] }, { result: boolean }]

      return {
        collateralCapacity: poolInfoResponse.result[0]!,
        collateralBalance: poolInfoResponse.result[1]!,
        rawCollateral: poolInfoResponse.result[2]!,
        debtCapacity: poolInfoResponse.result[3]!,
        debtBalance: poolInfoResponse.result[4]!,
        isPaused: pausedResponse.result,
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

    const buyPrice = await this.price.getBuyPrice()
    const sellPrice = await this.price.getSellPrice()
    const averagePrice = cBN(buyPrice).add(cBN(sellPrice)).div(2).toString()

    return {
      ...this.config,
      ...poolData,
      ...oraclePrice,
      collRest: poolData.collateralCapacity - poolData.collateralBalance,
      debtRest: poolData.debtCapacity - poolData.debtBalance,
      rateRes,

      averagePrice,
      openPrice: isShort ? sellPrice : buyPrice,
      closePrice: isShort ? buyPrice : sellPrice,
    }
  }
}
