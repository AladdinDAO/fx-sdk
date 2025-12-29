import { getClient } from '@/core/client'
import { isAddress } from 'viem'
import { Position } from '@/core/position'
import { PoolName } from '@/types'
import { Pool } from '@/core/pool'
import { AdjustPositionLeverageRequest, IncreasePositionRequest, ReducePositionRequest, DepositAndMintRequest, RepayAndWithdrawRequest } from '@/types'
import { getOwnerOf } from '@/utils/service'

export interface FxSdkConfig {
  rpcUrl?: string
  chainId?: number
}

export class FxSdk {
  constructor(config?: FxSdkConfig) {
    getClient(config?.chainId, config?.rpcUrl)
  }

  async increasePosition(request: IncreasePositionRequest) {
    const {
      poolName,
      positionId,
      leverage,
      inputTokenAddress,
      amount,
      slippage,
      userAddress,
    } = request

    if (amount <= 0) {
      throw new Error('From amount must be greater than 0')
    }

    if (!isAddress(inputTokenAddress)) {
      throw new Error('From token address is not a valid address')
    }

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100')
    }

    if (leverage <= 0) {
      throw new Error('Leverage must be greater than 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a positive number')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address is not a valid address')
    }

    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of the position')
      }
    }

    const poolInfo = await pool.getPoolInfo()

    const position = new Position({
      positionId,
      poolInfo,
      userAddress,
    })

    return position.increasePosition({
      ...request,
      inputTokenAddress: inputTokenAddress.toLowerCase(),
    })
  }

  async reducePosition(request: ReducePositionRequest) {
    const {
      poolName,
      positionId,
      outputTokenAddress,
      amount,
      slippage,
      userAddress,
    } = request

    if (amount <= 0) {
      throw new Error('From amount must be greater than 0')
    }

    if (!isAddress(outputTokenAddress)) {
      throw new Error('From token address is not a valid address')
    }

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a positive number')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address is not a valid address')
    }

    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of the position')
      }
    }

    const poolInfo = await pool.getPoolInfo()

    const position = new Position({
      positionId,
      poolInfo,
      userAddress,
    })

    return position.reducePosition({
      ...request,
      outputTokenAddress: outputTokenAddress.toLowerCase(),
    })
  }

  async adjustPositionLeverage(request: AdjustPositionLeverageRequest) {
    const {
      poolName,
      positionId,
      leverage,
      slippage,
      userAddress,
    } = request

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100')
    }

    if (leverage <= 0) {
      throw new Error('Leverage must be greater than 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a positive number')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address is not a valid address')
    }

    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of the position')
      }
    }

    const poolInfo = await pool.getPoolInfo()

    const position = new Position({
      positionId,
      poolInfo,
      userAddress,
    })

    return position.adjustPositionLeverage(request)
  }

  async depositAndMint(request: DepositAndMintRequest) {
    const {
      poolName,
      positionId,
      depositTokenAddress,
      depositAmount,
      mintAmount,
      userAddress,
    } = request

    if (depositAmount < 0) {
      throw new Error('Deposit amount must be greater than or equal to 0')
    }

    if (!isAddress(depositTokenAddress)) {
      throw new Error('Deposit token address is not a valid address')
    }

    if (mintAmount < 0) {
      throw new Error('Mint amount must be greater than or equal to 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a positive number')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address is not a valid address')
    }

    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of the position')
      }
    }

    const poolInfo = await pool.getPoolInfo()

    const position = new Position({
      positionId,
      poolInfo,
      userAddress,
    })

    return position.depositAndMint({
      ...request,
      depositTokenAddress: depositTokenAddress.toLowerCase(),
    })
  }

  async repayAndWithdraw(request: RepayAndWithdrawRequest) {
    const {
      poolName,
      positionId,
      repayAmount,
      withdrawAmount,
      withdrawTokenAddress,
      userAddress,
    } = request

    if (repayAmount < 0) {
      throw new Error('Repay amount must be greater than or equal to 0')
    }

    if (!isAddress(withdrawTokenAddress)) {
      throw new Error('Withdraw token address is not a valid address')
    }

    if (withdrawAmount < 0) {
      throw new Error('Withdraw amount must be greater than or equal to 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a positive number')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address is not a valid address')
    }

    if (!(poolName in PoolName)) {
      throw new Error('Pool name is not supported')
    }

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of the position')
      }
    }

    const poolInfo = await pool.getPoolInfo()

    const position = new Position({
      positionId,
      poolInfo,
      userAddress,
    })

    return position.repayAndWithdraw({
      ...request,
      withdrawTokenAddress: withdrawTokenAddress.toLowerCase(),
    })
  }

}
