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
  /** Optional RPC URL for blockchain connection. Defaults to configured value. */
  rpcUrl?: string
  /** Optional chain ID. Default is 1 (Ethereum mainnet). */
  chainId?: number
}

export class FxSdk {
  constructor(config?: FxSdkConfig) {
    getClient(config?.chainId, config?.rpcUrl)
  }

  /**
   * Get all positions for a user in a specific market and position type.
   * @param request - Request parameters
   * @param request.userAddress - The user's wallet address
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @returns Array of position information objects
   */
  async getPositions(request: {
    /** The user's wallet address */
    userAddress: string
    /** Market type: 'ETH' or 'BTC' */
    market: Market
    /** Position type: 'long' or 'short' */
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

  /**
   * Increase a position or open a new position.
   * @param request - Request parameters
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Position ID (0 for new position, > 0 for existing position)
   * @param request.leverage - Leverage multiplier (must be greater than 0)
   * @param request.inputTokenAddress - Input token contract address
   * @param request.amount - Input amount in wei units (bigint)
   * @param request.slippage - Slippage tolerance as percentage (0-100)
   * @param request.userAddress - User's wallet address
   * @param request.targets - Optional array of route types to use
   * @returns Object containing route options with transaction arrays
   */
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

  /**
   * Reduce a position or close a position.
   * @param request - Request parameters
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.outputTokenAddress - Output token contract address
   * @param request.amount - Amount to reduce in wei units (bigint)
   * @param request.slippage - Slippage tolerance as percentage (0-100)
   * @param request.userAddress - User's wallet address
   * @param request.isClosePosition - Optional flag to fully close the position
   * @param request.targets - Optional array of route types to use
   * @returns Object containing route options with transaction arrays
   */
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
      const tokenAddresses = [tokens.eth, tokens.weth, tokens.wstETH, tokens.usdc, tokens.usdt, tokens.fxUSD]
      if (type === 'long') {
        tokenAddresses.push(tokens.stETH)
      }
      if (!tokenAddresses.includes(outputTokenAddress)) {
        throw new Error(`Output token address must be eth, ${type === 'long' ? 'stETH,' : ''} wstETH, usdc, usdt or fxUSD`)
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

  /**
   * Adjust the leverage multiplier of an existing position.
   * @param request - Request parameters
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.leverage - Target leverage multiplier (must be greater than 0)
   * @param request.slippage - Slippage tolerance as percentage (0-100)
   * @param request.userAddress - User's wallet address
   * @param request.targets - Optional array of route types to use
   * @returns Object containing route options with transaction arrays
   */
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

  /**
   * Deposit collateral to a position and mint fxUSD.
   * Note: Only supports long positions.
   * @param request - Request parameters
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.positionId - Position ID (0 for new position, > 0 for existing position)
   * @param request.userAddress - User's wallet address
   * @param request.depositTokenAddress - Deposit token contract address
   * @param request.depositAmount - Amount of collateral to deposit in wei units (bigint)
   * @param request.mintAmount - Amount of fxUSD to mint in wei units (bigint)
   * @returns Object containing transaction array
   */
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
      if (![tokens.eth, tokens.stETH, tokens.weth, tokens.wstETH].includes(depositTokenAddress)) {
        throw new Error('Deposit token address must be eth, stETH, weth or wstETH')
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

  /**
   * Repay debt and withdraw collateral from a position.
   * Note: Only supports long positions.
   * @param request - Request parameters
   * @param request.market - Market type: 'ETH' or 'BTC'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.userAddress - User's wallet address
   * @param request.repayAmount - Amount of fxUSD to repay in wei units (bigint)
   * @param request.withdrawAmount - Amount of collateral to withdraw in wei units (bigint)
   * @param request.withdrawTokenAddress - Withdraw token contract address
   * @returns Object containing transaction array
   */
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
