import {
  ConvertData,
  DepositAndMintRequest,
  PoolInfo,
  RepayAndWithdrawRequest,
} from '@/types'
import { FxRoute } from '@/core/aggregators/fxRoute'
import { tokens } from '@/configs/tokens'
import { cBN, getLeverage, getLeverageByDebtRatio, getLTV } from '@/utils'
import { getClient } from '@/core/client'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import PositionOperateFacetAbi from '@/abis/PositionOperateFacet.json'
import { encodeFunctionData } from 'viem'
import { getDecimals, getNonce } from '@/utils/service'
import { approvePosition, approveToken } from '@/utils/approve'
import { contracts } from '@/configs/contracts'
import { getZapRoutes } from '@/utils/zapRoute'
import { PRECISION } from '@/configs'
import { Position } from '@/core/position'

/**
 * fxMINT operations: deposit collateral to mint fxUSD at 0% interest, and
 * repay fxUSD to withdraw collateral.
 *
 * Supports long pools only. Routed through `FxMintRouter` + `PositionOperateFacet`,
 * which is a different code path from the leveraged trading in {@link Position}
 * (Router_Diamond + flash-loan facets) — hence the separate class.
 *
 * Exposes two state-changing flows and two read-only previews:
 *  - {@link depositAndMint}: build txs to deposit + mint, with preview metrics
 *  - {@link repayAndWithdraw}: build txs to repay + withdraw, with preview metrics
 *  - {@link getMintableRange}: bound `mintAmount` before depositAndMint
 *  - {@link getWithdrawableRange}: bound `withdrawAmount` before repayAndWithdraw
 */
export class FxMint {
  private positionId: number
  private poolInfo: PoolInfo
  private userAddress: string
  private position: Position

  constructor({
    poolInfo,
    positionId,
    userAddress,
  }: {
    /** Pool information object (must be a long pool) */
    poolInfo: PoolInfo
    /** Position ID (0 for new position, > 0 for existing position) */
    positionId: number
    /** User's wallet address */
    userAddress: string
  }) {
    this.poolInfo = poolInfo
    this.positionId = positionId
    this.userAddress = userAddress
    this.position = new Position({ poolInfo, positionId, userAddress })
  }

  /**
   * Reads the current `(rawColls, rawDebts)` from the pool and derives `ltv`
   * (loan-to-value) for the preview. fxMINT is long-only, so `rawColls` is
   * already the underlying collateral amount — no rateRes normalisation
   * needed.
   */
  private async getCurrentState() {
    const { rawColls, rawDebts } = await this.position.getPosition()
    const ltv = getLTV(rawDebts, rawColls, this.poolInfo.anchorPrice)
    return { rawColls, rawDebts, ltv }
  }

  /**
   * Build the transactions to deposit collateral into a (new or existing)
   * long position and mint fxUSD, together with preview metrics the UI should
   * render before broadcasting.
   *
   * Preview fields on the result:
   *  - `ltv` / `newLtv` — loan-to-value before vs. after the trade
   *  - `fee` (= `mintAmount * borrowFeeRatio`) and `feeRatio`
   *  - `leverage` — target position leverage after the trade
   *  - `executionPrice` — pool min price used to size the trade
   *  - `isZapIn` — true when `depositTokenAddress` differs from the pool's deltaColl
   *  - `minOut` — minimum deltaColl after zap (0.1% slippage tolerance)
   *
   * Caller should `await` each tx receipt and send in nonce order.
   */
  async depositAndMint({
    depositTokenAddress,
    depositAmount,
    mintAmount,
  }: DepositAndMintRequest) {
    const {
      precision,
      poolAddress,
      deltaCollAddress,
      minPrice,
      rateRes,
      anchorPrice,
      borrowFeeRatio,
    } = this.poolInfo

    const { rawColls, rawDebts, ltv } = await this.getCurrentState()

    let convertData: ConvertData = {
      encoding: 0n,
      routes: [],
    }
    let _deltaCollAmount = depositAmount

    const isZapIn = depositTokenAddress !== deltaCollAddress

    if (isZapIn && depositAmount > 0) {
      const fxRoute = new FxRoute()
      const quote = await fxRoute.getQuote({
        src: depositTokenAddress === tokens.eth ? tokens.weth : depositTokenAddress,
        dst: deltaCollAddress,
        amount: depositAmount,
      })

      convertData = quote.convertData
      _deltaCollAmount = quote.dst
    }

    const debt = cBN(rawDebts).plus(mintAmount)

    const size = cBN(_deltaCollAmount)
      .div(precision)
      .times(minPrice)
      .div(PRECISION)
      .times(rateRes)

    const totalSize = size.plus(cBN(rawColls).times(minPrice).div(PRECISION))

    const positionTargetLeverage = getLeverage(totalSize, debt)

    const debts = cBN(rawDebts).plus(mintAmount).toFixed(0)
    const colls = cBN(rawColls)
      .plus(cBN(_deltaCollAmount).div(precision).times(rateRes))
      .toFixed(0)

    const minOutStr = cBN(_deltaCollAmount)
      .times(100 - 0.1)
      .div(100)
      .toFixed(0)

    const price = cBN(minPrice).div(PRECISION).toFixed(0, 4)

    // Preview metrics: project ltv using the post-trade colls/debts, and
    // compute the deposit fee from borrowFeeRatio.
    const newLtv = getLTV(debts, colls, anchorPrice)
    const fee = cBN(mintAmount).times(borrowFeeRatio || 0).toFixed(0)

    const data = [
      {
        tokenIn: depositTokenAddress,
        amount: depositAmount,
        target: contracts.TokenConverter_MultiPathConverter,
        data: encodeFunctionData({
          abi: MultiPathConverterAbi,
          functionName: 'convert',
          args: [
            depositTokenAddress,
            depositAmount,
            convertData.encoding,
            convertData.routes,
          ],
        }),
        minOut: minOutStr,
        signature: '0x',
      },
      {
        pool: poolAddress,
        positionId: this.positionId,
        borrowAmount: mintAmount,
      },
    ]

    const approveTokenTx = await approveToken({
      tokenAddress: depositTokenAddress,
      amount: depositAmount,
      spender: contracts.FxMintRouter,
      userAddress: this.userAddress,
    })

    const approvePositionTx = await approvePosition({
      poolAddress: this.poolInfo.poolAddress,
      positionId: this.positionId,
      operator: contracts.FxMintRouter,
      userAddress: this.userAddress,
    })

    const currentNonce = await getNonce(this.userAddress)
    const chainId = getClient().chain?.id

    const txs = []
    let nonce = currentNonce

    if (approveTokenTx) {
      txs.push({ ...approveTokenTx, nonce: nonce++, chainId })
    }

    if (approvePositionTx) {
      txs.push({ ...approvePositionTx, nonce: nonce++, chainId })
    }

    txs.push({
      type: 'trade',
      from: this.userAddress,
      to: contracts.FxMintRouter,
      data: encodeFunctionData({
        abi: PositionOperateFacetAbi,
        functionName: 'borrowFromLong',
        args: data,
      }),
      value: depositTokenAddress === tokens.eth ? depositAmount : 0n,
      nonce,
      chainId,
    })

    return {
      positionId: this.positionId,
      leverage: positionTargetLeverage,
      executionPrice: price,
      colls,
      debts,
      ltv,
      newLtv,
      fee: BigInt(fee),
      feeRatio: borrowFeeRatio,
      isZapIn,
      minOut: BigInt(minOutStr),
      txs,
    }
  }

  /**
   * Build the transactions to repay fxUSD debt and withdraw collateral from
   * an existing long position, together with preview metrics for the UI.
   *
   * Preview fields on the result:
   *  - `ltv` / `newLtv` — loan-to-value before vs. after (0 when `isClose`)
   *  - `fee` (= `repayAmount * repayFeeRatio`) and `feeRatio`
   *  - `payAmount` (= `repayAmount * (1 + repayFeeRatio)`) — the fxUSD the
   *    wallet must actually hold; includes the fee
   *  - `isClose` — true when the repayment fully closes the position
   *    (`rawDebts - repayAmount <= 0`); the SDK forces a full debt payoff
   *  - `isZapOut` — true when `withdrawTokenAddress` differs from the pool's
   *    deltaColl (the SDK appends a zap-out leg)
   *  - `minOut` — minimum withdraw token (0.1% slippage tolerance)
   *
   * Caller should `await` each tx receipt and send in nonce order.
   */
  async repayAndWithdraw({
    repayAmount,
    withdrawAmount,
    withdrawTokenAddress,
  }: RepayAndWithdrawRequest) {
    const {
      precision,
      deltaCollAddress,
      rateRes,
      minPrice,
      poolAddress,
      repayFeeRatio,
      anchorPrice,
    } = this.poolInfo

    const { rawColls, rawDebts, ltv } = await this.getCurrentState()

    let convertData: ConvertData = {
      encoding: 0n,
      routes: [],
    }

    let deltaColl = withdrawAmount.toString()
    let deltaDebt = repayAmount.toString()
    const _toAmount = withdrawAmount
    let withdrawCollAmount

    const isZapOut = withdrawTokenAddress !== deltaCollAddress

    const decimals = await getDecimals(withdrawTokenAddress)

    if (isZapOut && withdrawAmount > 0) {
      deltaColl = cBN(withdrawAmount)
        .div(`1e${decimals.toString()}`)
        .times(PRECISION)
        .div(rateRes)
        .times(precision)
        .toFixed(0)

      convertData = getZapRoutes({
        fromTokenAddress: deltaCollAddress,
        toTokenAddress:
          withdrawTokenAddress === tokens.eth ? tokens.weth : withdrawTokenAddress,
      })
    }

    const debtAfter = cBN(rawDebts).minus(deltaDebt)

    let totalSize = cBN(0)
    let targetLeverage = 0

    const isClose = cBN(rawDebts).lte(deltaDebt)

    if (isClose) {
      deltaDebt = cBN(rawDebts).plus(1e9).toFixed(0)
      withdrawCollAmount = rawColls
    } else {
      withdrawCollAmount = cBN(deltaColl)
        .div(precision)
        .times(rateRes)
        .toFixed(0, 1)
      const size = cBN(deltaColl)
        .times(minPrice)
        .div(PRECISION)
        .times(rateRes)
        .div(precision)

      totalSize = cBN(cBN(rawColls).times(minPrice).div(PRECISION)).minus(size)

      targetLeverage = getLeverage(totalSize, debtAfter)
    }

    const payAmount = cBN(deltaDebt)
      .times(1 + Number(repayFeeRatio))
      .toFixed(0)

    const debts = cBN(rawDebts).minus(deltaDebt).toFixed(0)
    const colls = cBN(rawColls).minus(withdrawCollAmount).toFixed(0)

    const minOutStr = cBN(_toAmount)
      .times(100 - 0.1)
      .div(100)
      .toFixed(0)

    const price = cBN(minPrice).div(PRECISION).toFixed(0, 4)

    // Preview metrics: on full close, newLtv collapses to 0 and the position
    // surrenders its full collateral; otherwise project ltv from the
    // post-trade colls/debts.
    const newLtv = isClose ? 0 : getLTV(debts, colls, anchorPrice)
    const fee = cBN(repayAmount).times(repayFeeRatio || 0).toFixed(0)

    const data = [
      {
        tokenIn: tokens.fxUSD,
        amount: payAmount,
        target: contracts.TokenConverter_MultiPathConverter,
        data: encodeFunctionData({
          abi: MultiPathConverterAbi,
          functionName: 'convert',
          args: [tokens.fxUSD, payAmount, 0n, []],
        }),
        minOut: deltaDebt,
        signature: '0x',
      },
      {
        pool: poolAddress,
        positionId: this.positionId,
        withdrawAmount: deltaColl,
      },
      isZapOut
        ? {
            tokenOut: withdrawTokenAddress,
            converter: contracts.TokenConverter_MultiPathConverter,
            encodings: convertData.encoding,
            routes: convertData.routes,
            minOut: minOutStr,
            signature: '0x',
          }
        : null,
    ]

    const approveTokenTx = await approveToken({
      tokenAddress: tokens.fxUSD,
      amount: BigInt(payAmount),
      spender: contracts.FxMintRouter,
      userAddress: this.userAddress,
    })

    const approvePositionTx = await approvePosition({
      poolAddress: this.poolInfo.poolAddress,
      positionId: this.positionId,
      operator: contracts.FxMintRouter,
      userAddress: this.userAddress,
    })

    const currentNonce = await getNonce(this.userAddress)
    const chainId = getClient().chain?.id

    const txs = []
    let nonce = currentNonce

    if (approveTokenTx) {
      txs.push({ ...approveTokenTx, nonce: nonce++, chainId })
    }

    if (approvePositionTx) {
      txs.push({ ...approvePositionTx, nonce: nonce++, chainId })
    }

    txs.push({
      type: 'trade',
      from: this.userAddress,
      to: contracts.FxMintRouter,
      data: encodeFunctionData({
        abi: PositionOperateFacetAbi,
        functionName: isZapOut ? 'repayToLongAndZapOut' : 'repayToLong',
        args: data.filter((item) => item !== null),
      }),
      value: 0n,
      nonce,
      chainId,
    })

    return {
      positionId: this.positionId,
      leverage: targetLeverage,
      executionPrice: price,
      colls,
      debts,
      ltv,
      newLtv,
      fee: BigInt(fee),
      feeRatio: repayFeeRatio,
      payAmount: BigInt(payAmount),
      isClose,
      isZapOut,
      minOut: BigInt(minOutStr),
      txs,
    }
  }

  /**
   * Read-only. Returns the inclusive `[minMint, maxMint]` fxUSD range the
   * pool will accept for a given `(positionId, depositAmount)`. The pool
   * reverts if `mintAmount` falls outside this range, so call this before
   * {@link depositAndMint} to bound user input.
   *
   * Derivation: with `size = (rawColls + addedColls) * minPrice`, the pool
   * enforces `minL ≤ size / (size - newDebt) ≤ maxL`, where `minL` / `maxL`
   * come from `poolMinDebtRatio` / `poolMaxDebtRatio`. Solving for `newDebt`
   * and subtracting `rawDebts` yields the mint range.
   *
   * @param depositTokenAddress - token used as deposit; if not the pool's
   *   `deltaCollAddress`, the SDK quotes a zap to estimate the effective coll
   *   added to the position.
   * @param depositAmount - input token amount in wei.
   */
  async getMintableRange({
    depositTokenAddress,
    depositAmount,
  }: {
    depositTokenAddress: string
    depositAmount: bigint
  }): Promise<{ minMint: bigint; maxMint: bigint }> {
    const {
      precision,
      deltaCollAddress,
      minPrice,
      rateRes,
      poolMinDebtRatio,
      poolMaxDebtRatio,
    } = this.poolInfo

    const minL = getLeverageByDebtRatio(poolMinDebtRatio.toString())
    const maxL = getLeverageByDebtRatio(poolMaxDebtRatio.toString())

    const { rawColls, rawDebts } = await this.position.getPosition()

    let _deltaCollAmount: string = depositAmount.toString()

    if (depositTokenAddress !== deltaCollAddress && depositAmount > 0n) {
      const fxRoute = new FxRoute()
      const quote = await fxRoute.getQuote({
        src:
          depositTokenAddress === tokens.eth ? tokens.weth : depositTokenAddress,
        dst: deltaCollAddress,
        amount: depositAmount,
      })
      _deltaCollAmount = quote.dst.toString()
    }

    // Convert deposit (in deltaColl precision) to USD size at minPrice * rateRes.
    const addedSize = cBN(_deltaCollAmount)
      .div(precision)
      .times(minPrice)
      .div(PRECISION)
      .times(rateRes)

    const totalSize = addedSize.plus(cBN(rawColls).times(minPrice).div(PRECISION))

    // debt = size * (1 - 1/leverage)
    const minDebt = totalSize.times(cBN(1).minus(cBN(1).div(minL || 1)))
    const maxDebt = totalSize.times(cBN(1).minus(cBN(1).div(maxL || 1)))

    const minRaw = minDebt.minus(rawDebts.toString())
    const maxRaw = maxDebt.minus(rawDebts.toString())

    const minMint = minRaw.lt(0) ? 0n : BigInt(minRaw.toFixed(0, 1))
    const maxMint = maxRaw.lt(0) ? 0n : BigInt(maxRaw.toFixed(0, 1))

    return { minMint, maxMint }
  }

  /**
   * Read-only. Returns the inclusive `[minWithdraw, maxWithdraw]` collateral
   * range for a given `repayAmount`, plus an `isClose` flag indicating that
   * the repayment fully closes the position (`rawDebts - repayAmount <= 0`).
   * When `isClose` is true, `min == max` — the position surrenders all of its
   * collateral.
   *
   * Range is denominated in `withdrawTokenAddress`'s native decimals.
   *
   * Derivation: with `size = (rawColls - withdraw) * minPrice` and post-repay
   * `debt = rawDebts - repayAmount`, the pool enforces
   * `minL ≤ size / (size - debt) ≤ maxL`. Solving for `withdraw` gives the
   * range; converting via `minPrice` lets us denominate it in the target token.
   */
  async getWithdrawableRange({
    repayAmount,
    withdrawTokenAddress,
  }: {
    repayAmount: bigint
    withdrawTokenAddress: string
  }): Promise<{
    minWithdraw: bigint
    maxWithdraw: bigint
    isClose: boolean
  }> {
    const { minPrice, poolMinDebtRatio, poolMaxDebtRatio } = this.poolInfo
    const minL = getLeverageByDebtRatio(poolMinDebtRatio.toString())
    const maxL = getLeverageByDebtRatio(poolMaxDebtRatio.toString())

    // fxMINT is long-only, so rawColls is already the underlying collateral
    // token amount (no rateRes normalisation needed).
    const { rawColls, rawDebts } = await this.position.getPosition()

    const debt = cBN(rawDebts).minus(repayAmount)
    const isClose = debt.lte(0)

    const decimals = await getDecimals(withdrawTokenAddress)
    const tokenScale = `1e${decimals.toString()}`

    if (isClose) {
      // Full close: surrender all collateral, converted at minPrice into the
      // withdraw token's native decimals.
      const withdrawAmount = cBN(rawColls.toString())
        .times(minPrice)
        .div(PRECISION)
        .times(tokenScale)
        .div(PRECISION)
        .toFixed(0, 1)
      const v = BigInt(withdrawAmount)
      return { minWithdraw: v, maxWithdraw: v, isClose: true }
    }

    // From  size = (colls - withdraw) * price  and  leverage = size / (size - debt),
    // solve for withdraw:  withdraw = colls + debt * L / (price * (1 - L))
    const withdrawAt = (leverage: number) =>
      cBN(rawColls.toString())
        .plus(
          cBN(debt)
            .times(leverage)
            .div(minPrice)
            .div(1 - leverage)
        )
        .times(minPrice)
        .div(PRECISION)
        .times(tokenScale)
        .div(PRECISION)

    const minVal = withdrawAt(minL || 0)
    const maxVal = withdrawAt(maxL || 0)

    const minWithdraw = minVal.lt(0) ? 0n : BigInt(minVal.toFixed(0, 1))
    const maxWithdraw = maxVal.lt(0) ? 0n : BigInt(maxVal.toFixed(0, 1))

    return { minWithdraw, maxWithdraw, isClose: false }
  }
}
