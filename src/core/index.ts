import { getClient } from '@/core/client'
import { isAddress } from 'viem'
import { Position } from '@/core/position'
import { PoolName } from '@/types'
import { Pool } from '@/core/pool'
import { IncreasePositionRequest } from '@/types'

export interface FxSdkConfig {
  userAddress: string
  rpcUrl?: string
  chainId?: number
}

export class FxSdk {
  readonly userAddress: string

  constructor(config: FxSdkConfig) {
    if (!isAddress(config.userAddress)) {
      throw new Error('User address is not a valid address')
    }

    this.userAddress = config.userAddress
    getClient(config.chainId, config.rpcUrl)
  }

  async increasePosition(request: IncreasePositionRequest) {
    const {
      poolName,
      positionId,
      leverage,
      fromAmount,
      fromTokenAddress,
      slippage,
    } = request
    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    if (positionId < 0) {
      throw new Error('Position ID must be greater than 0')
    }

    if (fromAmount <= 0) {
      throw new Error('From amount must be greater than 0')
    }

    if (!isAddress(fromTokenAddress)) {
      throw new Error('From token address is not a valid address')
    }

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100')
    }

    if (leverage <= 0) {
      throw new Error('Leverage must be greater than 0')
    }

    const pool = new Pool({ poolName })
    const poolInfo = await pool.getPoolInfo()
    // console.log('poolInfo-->', poolInfo)

    const position = new Position({
      positionId,
      poolInfo,
      userAddress: this.userAddress,
    })

    return position.increasePosition({
      ...request,
      fromTokenAddress: request.fromTokenAddress.toLowerCase(),
    })
  }
}
