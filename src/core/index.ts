import { getClient } from '@/core/client'
import { isAddress } from 'viem'
import { Position } from '@/core/position'
import { Pool } from '@/core/pool'
import { AdjustPositionLeverageRequest, IncreasePositionRequest, ReducePositionRequest, DepositAndMintRequest, RepayAndWithdrawRequest, Market, PositionType, BridgeQuoteRequest, BridgeQuoteResult, BuildBridgeTxRequest, BuildBridgeTxResult } from '@/types'
import { getBridgeQuote as getBridgeQuoteImpl, buildBridgeTx as buildBridgeTxImpl } from '@/bridge'
import { getOwnerOf } from '@/utils/service'
import { getPoolName } from '@/utils'
import { getPositionsByUser } from '@/utils/service'
import { tokens } from '@/configs/tokens'

export interface FxSdkConfig {
  /** RPC URL. Defaults to the configured value if omitted. */
  rpcUrl?: string
  /** Chain ID. Defaults to 1 (Ethereum mainnet) if omitted. */
  chainId?: number
}

export class FxSdk {
  constructor(config?: FxSdkConfig) {
    getClient(config?.chainId, config?.rpcUrl)
  }

  /**
   * Gets all positions for a user in a given market and position type.
   * @param request - Request parameters
   * @param request.userAddress - The user's wallet address
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @returns Array of position info objects (positionId, rawColls, rawDebts, currentLeverage, lsdLeverage)
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
   * Increases a position or opens a new one.
   * @param request - Request parameters
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Position ID (0 = new position, > 0 = existing)
   * @param request.leverage - Leverage multiplier (must be > 0)
   * @param request.inputTokenAddress - Input token contract address
   * @param request.amount - Input amount in wei (bigint)
   * @param request.slippage - Slippage tolerance in percent (0–100, exclusive)
   * @param request.userAddress - User's wallet address
   * @param request.targets - Optional route types to use
   * @returns Object with positionId, slippage, and routes (each route has txs to execute in order)
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
      throw new Error('Input amount must be greater than 0')
    }

    if (!isAddress(inputTokenAddress)) {
      throw new Error('Input token address must be a valid Ethereum address')
    }

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100 (exclusive)')
    }

    if (leverage <= 0) {
      throw new Error('Leverage must be greater than 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a non-negative integer')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address must be a valid Ethereum address')
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
        throw new Error('User is not the owner of this position')
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
   * Reduces a position or closes it fully.
   * @param request - Request parameters
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.outputTokenAddress - Output token contract address
   * @param request.amount - Amount to reduce in wei (bigint)
   * @param request.slippage - Slippage tolerance in percent (0–100, exclusive)
   * @param request.userAddress - User's wallet address
   * @param request.isClosePosition - If true, close the position entirely
   * @param request.targets - Optional route types to use
   * @returns Object with positionId, slippage, and routes (each route has txs to execute in order)
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
      throw new Error('Amount to reduce must be greater than 0')
    }

    if (!isAddress(outputTokenAddress)) {
      throw new Error('Output token address must be a valid Ethereum address')
    }

    if (slippage <= 0 || slippage >= 100) {
      throw new Error('Slippage must be between 0 and 100 (exclusive)')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a non-negative integer')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address must be a valid Ethereum address')
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
        throw new Error('User is not the owner of this position')
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
   * Adjusts the leverage of an existing position.
   * @param request - Request parameters
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.type - Position type: 'long' or 'short'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.leverage - Target leverage (must be > 0)
   * @param request.slippage - Slippage tolerance in percent (0–100, exclusive)
   * @param request.userAddress - User's wallet address
   * @param request.targets - Optional route types to use
   * @returns Object with positionId, slippage, and routes (each route has txs to execute in order)
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
      throw new Error('Slippage must be between 0 and 100 (exclusive)')
    }

    if (leverage <= 0) {
      throw new Error('Leverage must be greater than 0')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a non-negative integer')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address must be a valid Ethereum address')
    }

    const poolName = getPoolName(market, type)

    const pool = new Pool({ poolName })

    if (positionId > 0) {
      const owner = await getOwnerOf(pool.config.poolAddress, positionId)
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('User is not the owner of this position')
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
   * Deposits collateral into a position and mints fxUSD. Long positions only.
   * @param request - Request parameters
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.positionId - Position ID (0 = new, > 0 = existing)
   * @param request.userAddress - User's wallet address
   * @param request.depositTokenAddress - Deposit token contract address
   * @param request.depositAmount - Collateral amount in wei (bigint)
   * @param request.mintAmount - fxUSD amount to mint in wei (bigint)
   * @returns Object with transaction array (execute in order)
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
      throw new Error('Deposit amount must be non-negative')
    }

    if (!isAddress(depositTokenAddress)) {
      throw new Error('Deposit token address must be a valid Ethereum address')
    }

    if (mintAmount < 0) {
      throw new Error('Mint amount must be non-negative')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a non-negative integer')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address must be a valid Ethereum address')
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
        throw new Error('User is not the owner of this position')
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
   * Repays debt and withdraws collateral from a position. Long positions only.
   * @param request - Request parameters
   * @param request.market - Market: 'ETH' or 'BTC'
   * @param request.positionId - Existing position ID (must be > 0)
   * @param request.userAddress - User's wallet address
   * @param request.repayAmount - fxUSD amount to repay in wei (bigint)
   * @param request.withdrawAmount - Collateral amount to withdraw in wei (bigint)
   * @param request.withdrawTokenAddress - Withdraw token contract address
   * @returns Object with transaction array (execute in order)
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
      throw new Error('Repay amount must be non-negative')
    }

    if (!isAddress(withdrawTokenAddress)) {
      throw new Error('Withdraw token address must be a valid Ethereum address')
    }

    if (withdrawAmount < 0) {
      throw new Error('Withdraw amount must be non-negative')
    }

    if (typeof positionId !== 'number' || positionId < 0) {
      throw new Error('Position ID must be a non-negative integer')
    }

    if (!isAddress(userAddress)) {
      throw new Error('User address must be a valid Ethereum address')
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
        throw new Error('User is not the owner of this position')
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

  /**
   * Gets a fee quote for bridging tokens between Base and Ethereum via LayerZero V2 OFT.
   * @param request - sourceChainId (1 | 8453), destChainId (1 | 8453), token (key or OFT address), amount, recipient
   * @returns { nativeFee, lzTokenFee } in wei
   */
  async getBridgeQuote(request: BridgeQuoteRequest): Promise<BridgeQuoteResult> {
    return getBridgeQuoteImpl(request)
  }

  /**
   * Builds the transaction payload to bridge tokens between Base and Ethereum via LayerZero V2 OFT.
   * @param request - Same as getBridgeQuote, with optional refundAddress
   * @returns { tx: { to, data, value }, quote } for sending on source chain
   */
  async buildBridgeTx(request: BuildBridgeTxRequest): Promise<BuildBridgeTxResult> {
    return buildBridgeTxImpl(request)
  }
}
