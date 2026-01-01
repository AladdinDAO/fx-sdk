import { getClient } from '@/core/client'
import { isAddress } from 'viem'
import { Position } from '@/core/position'
import { Pool } from '@/core/pool'
import { AdjustPositionLeverageRequest, IncreasePositionRequest, ReducePositionRequest, DepositAndMintRequest, RepayAndWithdrawRequest, Market, PositionType } from '@/types'
import { getOwnerOf } from '@/utils/service'
import { getPoolName } from '@/utils'
import { getPositionsByUser } from '@/utils/service'
import { tokens } from '@/configs/tokens'

export interface FxSdkConfig {
  rpcUrl?: string
  chainId?: number
}

export class FxSdk {
  constructor(config?: FxSdkConfig) {
    getClient(config?.chainId, config?.rpcUrl)
  }

  async getPositions(request: {
    userAddress: string
    market: Market
    type: PositionType
  }) {
    const { userAddress, market, type } = request

    const poolName = getPoolName(market, type)

    const positionIds = await getPositionsByUser(poolName, userAddress)

    if (positionIds.length === 0) {
      return []
    }

    const pool = new Pool({ poolName })
    const poolInfo = await pool.getPoolInfo()

    const positions = await Promise.all(positionIds.map(async (positionId) => {
      return new Position({
        positionId,
        poolInfo,
        userAddress,
      }).getPositionInfo()
    }))

    return positions
  } 

  async increasePosition(request: IncreasePositionRequest) {
    const {
      market,
      type,
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

    const poolName = getPoolName(market, type)

    if (market === 'ETH') {
      if (![tokens.eth, tokens.stETH, tokens.weth, tokens.wstETH, tokens.usdc, tokens.usdt, tokens.fxUSD].includes(inputTokenAddress)) {
        throw new Error('Input token address must be eth, stETH, weth, wstETH, usdc, usdt or fxUSD')
      }
    } else if (market === 'BTC') {
      if (![tokens.WBTC, tokens.usdc, tokens.usdt, tokens.fxUSD].includes(inputTokenAddress)) {
        throw new Error('Input token address must be WBTC, usdc, usdt or fxUSD')
      }
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
      market,
      type,
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

    const poolName = getPoolName(market, type)

    if (market === 'ETH') {
      if (![tokens.stETH, tokens.weth, tokens.wstETH, tokens.usdc, tokens.usdt, tokens.fxUSD].includes(outputTokenAddress)) {
        throw new Error('Output token address must be stETH, weth, wstETH, usdc, usdt or fxUSD')
      }
    } else if (market === 'BTC') {
      if (![tokens.WBTC, tokens.usdc, tokens.usdt, tokens.fxUSD].includes(outputTokenAddress)) {
        throw new Error('Output token address must be WBTC, usdc, usdt or fxUSD')
      }
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
      market,
      type,
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

    const poolName = getPoolName(market, type)

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
      market,
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

    const poolName = getPoolName(market, 'long')

    if (market === 'ETH') {
      if (![tokens.stETH, tokens.weth, tokens.wstETH].includes(depositTokenAddress)) {
        throw new Error('Deposit token address must be stETH, weth or wstETH')
      }
    } else if (market === 'BTC') {
      if (![tokens.WBTC].includes(depositTokenAddress)) {
        throw new Error('Deposit token address must be WBTC')
      }
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
      market,
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

    const poolName = getPoolName(market, 'long')

    if (market === 'ETH') {
      if (![tokens.eth, tokens.stETH, tokens.weth, tokens.wstETH].includes(withdrawTokenAddress)) {
        throw new Error('Withdraw token address must be eth, stETH, weth or wstETH')
      }
    } else if (market === 'BTC') {
      if (![tokens.WBTC].includes(withdrawTokenAddress)) {
        throw new Error('Withdraw token address must be WBTC')
      }
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
