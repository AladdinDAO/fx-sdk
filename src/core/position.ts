import AFPoolAbi from '@/abis/AFPool.json'
import { AdjustPositionLeverageRequest, ConvertData, DepositAndMintRequest, IncreasePositionRequest, PoolInfo, ReducePositionRequest, RepayAndWithdrawRequest } from '@/types'
import { FxRoute } from '@/core/aggregators/fxRoute'
import { tokens } from '@/configs/tokens'
import { cBN, getLeverage } from '@/utils'
import { getClient } from '@/core/client'
import { openOrAddFlashLoanQuote, closeOrRemoveFlashLoanQuote, downLeverageQuote } from '@/utils/longFlashLoan'
import PositionOperateFlashLoanFacetV2Abi from '@/abis/PositionOperateFlashLoanFacetV2.json'
import ShortPositionOperateFlashLoanFacetAbi from '@/abis/ShortPositionOperateFlashLoanFacet.json'
import LongPositionEmergencyCloseFacetAbi from '@/abis/LongPositionEmergencyCloseFacet.json'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { encodeFunctionData } from 'viem'
import { getDecimals, getNonce } from '@/utils/service'
import { approvePosition, approveToken } from '@/utils/approve'
import { contracts } from '@/configs/contracts'
import { getZapRoutes } from '@/utils/zapRoute'
import { closeOrRemoveShortFlashLoanQuote, downLeverageShortFlashLoanQuote, openOrAddShortFlashLoanQuote } from '@/utils/shortFlashLoan'
import { PRECISION } from '@/configs'
import PositionOperateFacetAbi from '@/abis/PositionOperateFacet.json'

export class Position {
  private positionId: number
  private poolInfo: PoolInfo
  private userAddress: string

  constructor({
    poolInfo,
    positionId,
    userAddress,
  }: {
    poolInfo: PoolInfo
    positionId: number
    userAddress: string
  }) {
    this.positionId = positionId
    this.poolInfo = poolInfo
    this.userAddress = userAddress
  }

  async getPosition() {
    if (this.positionId === 0) {
      return {
        rawColls: 0n,
        rawDebts: 0n,
      }
    }
    const position = await getClient().readContract({
      address: this.poolInfo.poolAddress as `0x${string}`,
      abi: AFPoolAbi,
      functionName: 'getPosition',
      args: [this.positionId],
    })

    if (!Array.isArray(position)) {
      throw new Error('Unexpected result from getPosition')
    }

    return {
      rawColls: position[0] as bigint,
      rawDebts: position[1] as bigint,
    }
  }

  async getPositionInfo() {
    const position = await this.getPosition()
    const { rawColls, rawDebts } = position

    const {
      minPrecision,
      isShort,
      rateRes,
      averagePrice: price,
    } = this.poolInfo

    const _isClosed = cBN(rawColls).lt(5 * minPrecision)

    const _rawColls = _isClosed ? 0 : rawColls
    const _rawDebts = _isClosed
      ? 0
      : isShort
        ? cBN(rawDebts).times(rateRes).div(PRECISION).toFixed(0)
        : rawDebts

    const currentSize = cBN(_rawColls)
      .times(isShort ? 1 : price)
      .toFixed(0)

    const debtUsd = cBN(_rawDebts)
      .times(isShort ? price : 1)
      .toFixed(0)

    const currentLeverage = getLeverage(currentSize, debtUsd)

    const positionInfo = {
      rawColls,
      rawDebts,
      currentLeverage,
      lsdLeverage: isShort ? currentLeverage - 1 : currentLeverage
    }

    console.log('positionInfo-->', positionInfo)

    return positionInfo
  }

  async increasePosition({
    inputTokenAddress,
    amount,
    leverage,
    slippage,
    targets,
  }: IncreasePositionRequest) {
    const { isShort, precision, deltaCollAddress, rateRes } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts, currentLeverage } = positionInfo

    let _leverage = isShort ? leverage + 1 : leverage
    let _deltaCollAmount = amount
    let convertInRoute: ConvertData = {
      encoding: 0n,
      routes: [],
    }

    if (inputTokenAddress !== deltaCollAddress) {
      const fxRoute = new FxRoute()
      const quote = await fxRoute.getQuote({
        src: inputTokenAddress === tokens.eth ? tokens.weth : inputTokenAddress,
        dst: deltaCollAddress,
        amount,
      })

      convertInRoute = quote.convertData

      _deltaCollAmount = quote.dst
    }

    if (currentLeverage > 0) {
      if (isShort) {
        const a = cBN(_deltaCollAmount)
          .times(_leverage)
          .plus(rawColls)
          .times(currentLeverage)
        const b = cBN(_deltaCollAmount).times(currentLeverage).plus(rawColls)
        _leverage = a.div(b).toNumber()
      } else {
        const a = cBN(_deltaCollAmount)
          .div(precision)
          .times(PRECISION)
          .times(_leverage)
          .times(rateRes)
          .div(PRECISION)
          .plus(rawColls)
          .times(currentLeverage)
        const b = cBN(_deltaCollAmount)
          .div(precision)
          .times(PRECISION)
          .times(currentLeverage)
          .times(rateRes)
          .div(PRECISION)
          .plus(rawColls)
        _leverage = a.div(b).toNumber()
      }
    }

    const quoteFunc = isShort ? openOrAddShortFlashLoanQuote : openOrAddFlashLoanQuote

    const routeList = await quoteFunc({
      tokenAddress: inputTokenAddress,
      positionId: this.positionId,
      amountIn: amount,
      convertInRoute,
      currentColls: rawColls,
      currentDebts: rawDebts,
      leverage: _leverage,
      slippage: slippage * 100,
      targets,
      poolInfo: this.poolInfo,
    })

    const approveTokenTx = await approveToken({
      tokenAddress: inputTokenAddress,
      amount,
      spender: contracts.Router_Diamond,
      userAddress: this.userAddress,
    })

    const approvePositionTx = await approvePosition({
      poolAddress: this.poolInfo.poolAddress,
      positionId: this.positionId,
      operator: contracts.Router_Diamond,
      userAddress: this.userAddress,
    })

    const currentNonce = await getNonce(this.userAddress)
    const chainId = getClient().chain?.id

    const routes = routeList.map((item) => {
      const txs = []
      let nonce = currentNonce

      if (approveTokenTx) {
        txs.push({
          ...approveTokenTx,
          nonce: nonce++,
          chainId,
        })
      }

      if (approvePositionTx) {
        txs.push({
          ...approvePositionTx,
          nonce: nonce++,
          chainId,
        })
      }

      txs.push({
        type: 'trade',
        from: this.userAddress,
        to: contracts.Router_Diamond,
        data: encodeFunctionData({
          abi: isShort ? ShortPositionOperateFlashLoanFacetAbi : PositionOperateFlashLoanFacetV2Abi,
          functionName: isShort
            ? 'openOrAddShortPositionFlashLoan'
            : 'openOrAddPositionFlashLoanV2',
          args: item.data,
        }),
        value: inputTokenAddress === tokens.eth ? amount : 0n,
        nonce,
        chainId,
      })

      return {
        routeType: item.params.routeType,
        leverage: item.params.positionLeverage,
        executionPrice: item.params.curPrice,
        colls: item.params.colls,
        debts: item.params.debts,
        txs,
      }
    })

    return {
      positionId: this.positionId,
      slippage,
      routes,
    }
  }

  async reducePosition({
    outputTokenAddress,
    amount,
    slippage,
    targets,
    isClosePosition,
  }: ReducePositionRequest) {
    const { isShort, deltaCollAddress, rateRes, averagePrice } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts, currentLeverage, lsdLeverage } = positionInfo

    let withdrawAmount

    const _fromAmount = amount

    if (isShort) {
      const debtRest = cBN(rawDebts)
        .times(rateRes)
        .div(PRECISION)
        .minus(_fromAmount)
        .times(averagePrice)
      withdrawAmount = cBN(rawColls)
        .minus(debtRest)
        .minus(cBN(debtRest).div(lsdLeverage))
        .toFixed(0)
    } else {
      withdrawAmount = cBN(_fromAmount).div(rateRes).times(PRECISION).toFixed(0)
    }

    let _leverage = currentLeverage
    if (isClosePosition) {
      _leverage = 0
    }

    let convertOutRoute: ConvertData = {
      encoding: 0n,
      routes: [],
    }

    if (outputTokenAddress !== deltaCollAddress) {
      convertOutRoute = getZapRoutes({
        fromTokenAddress: deltaCollAddress,
        toTokenAddress: outputTokenAddress === tokens.eth ? tokens.weth : outputTokenAddress,
      })
    }

    const quoteFunc = isShort ? closeOrRemoveShortFlashLoanQuote : closeOrRemoveFlashLoanQuote

    const routeList = await quoteFunc({
      tokenAddress: outputTokenAddress,
      positionId: this.positionId,
      withdrawDeltaCollAmount: withdrawAmount,
      convertOutRoute,
      leverage: _leverage,
      slippage: slippage * 100,
      currentColls: rawColls,
      currentDebts: rawDebts,
      targets,
      poolInfo: this.poolInfo,
    })

    const approvePositionTx = await approvePosition({
      poolAddress: this.poolInfo.poolAddress,
      positionId: this.positionId,
      operator: contracts.Router_Diamond,
      userAddress: this.userAddress,
    })

    const currentNonce = await getNonce(this.userAddress)
    const chainId = getClient().chain?.id

    const routes = routeList.map((item) => {
      const txs = []
      let nonce = currentNonce

      if (approvePositionTx) {
        txs.push({
          ...approvePositionTx,
          nonce: nonce++,
          chainId,
        })
      }

      txs.push({
        type: 'trade',
        from: this.userAddress,
        to: contracts.Router_Diamond,
        data: encodeFunctionData({
          abi: isShort ? ShortPositionOperateFlashLoanFacetAbi : LongPositionEmergencyCloseFacetAbi,
          functionName: isShort
            ? 'closeOrRemoveShortPositionFlashLoan'
            : 'closeOrRemovePositionFlashLoanV2',
          args: item.data,
        }),
        value: 0n,
        nonce,
        chainId,
      })

      return {
        routeType: item.params.routeType,
        leverage: item.params.positionLeverage,
        executionPrice: item.params.curPrice,
        minOut: item.params.minOut,
        colls: item.params.colls,
        debts: item.params.debts,
        txs,
      }
    })

    return {
      positionId: this.positionId,
      slippage,
      routes,
    }
  }

  async adjustPositionLeverage({
    leverage,
    slippage,
    targets,
  }: AdjustPositionLeverageRequest) {
    const { isShort, deltaCollAddress, rateRes } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts, currentLeverage, lsdLeverage } = positionInfo

    let routeList = []

    let functionName = ''

    if (leverage > lsdLeverage) {
      const quoteFunc = isShort ? openOrAddShortFlashLoanQuote : openOrAddFlashLoanQuote

      routeList = await quoteFunc({
        tokenAddress: deltaCollAddress,
        positionId: this.positionId,
        amountIn: 0n,
        convertInRoute: {
          encoding: 0n,
          routes: [],
        },
        currentColls: rawColls,
        currentDebts: rawDebts,
        leverage: isShort ? leverage + 1 : leverage,
        slippage: slippage * 100,
        targets,
        poolInfo: this.poolInfo,
      })

      functionName = isShort ? 'openOrAddShortPositionFlashLoan' : 'openOrAddPositionFlashLoanV2'
    } else {
      const colls = isShort
        ? rawColls
        : cBN(rawColls).div(rateRes).times(PRECISION)
      const _newLeverage = isShort ? leverage + 1 : leverage

      const withdrawAmount = cBN(colls)
        .times(currentLeverage - _newLeverage)
        .div(currentLeverage)
        .toFixed(0)

      const quoteFunc = isShort ? downLeverageShortFlashLoanQuote : downLeverageQuote

      routeList = await quoteFunc({
        tokenAddress: deltaCollAddress,
        withdrawDeltaCollAmount: withdrawAmount,
        convertOutRoute: {
          encoding: 0n,
          routes: [],
        },
        leverage: _newLeverage,
        slippage: slippage * 100,
        positionId: this.positionId,
        currentColls: rawColls,
        currentDebts: rawDebts,
        targets,
        poolInfo: this.poolInfo,
      })

      functionName = isShort ? 'closeOrRemoveShortPositionFlashLoan' : 'closeOrRemovePositionFlashLoanV2'
    }

    const approvePositionTx = await approvePosition({
      poolAddress: this.poolInfo.poolAddress,
      positionId: this.positionId,
      operator: contracts.Router_Diamond,
      userAddress: this.userAddress,
    })

    const currentNonce = await getNonce(this.userAddress)
    const chainId = getClient().chain?.id

    const routes = routeList.map((item) => {
      const txs = []
      let nonce = currentNonce

      if (approvePositionTx) {
        txs.push({
          ...approvePositionTx,
          nonce: nonce++,
          chainId,
        })
      }

      txs.push({
        type: 'trade',
        from: this.userAddress,
        to: contracts.Router_Diamond,
        data: encodeFunctionData({
          abi: isShort ? ShortPositionOperateFlashLoanFacetAbi : PositionOperateFlashLoanFacetV2Abi,
          functionName,
          args: item.data,
        }),
        value: 0n,
        nonce,
        chainId,
      })

      return {
        routeType: item.params.routeType,
        leverage: item.params.positionLeverage,
        executionPrice: item.params.curPrice,
        colls: item.params.colls,
        debts: item.params.debts,
        txs,
      }
    })

    return {
      positionId: this.positionId,
      slippage,
      routes,
    }

  }

  async depositAndMint({
    depositTokenAddress,
    depositAmount,
    mintAmount,
  }: DepositAndMintRequest) {
    const { precision, poolAddress, deltaCollAddress, minPrice, rateRes } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts } = positionInfo

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

    const minOut = cBN(_deltaCollAmount)
      .times(100 - 0.1)
      .div(100)
      .toFixed(0)

    const price = cBN(minPrice).div(PRECISION).toFixed(0, 4)

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
        minOut,
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
      txs.push({
        ...approveTokenTx,
        nonce: nonce++,
        chainId,
      })
    }

    if (approvePositionTx) {
      txs.push({
        ...approvePositionTx,
        nonce: nonce++,
        chainId,
      })
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
      colls: colls,
      debts: debts,
      txs,
    }
  }

  async repayAndWithdraw({
    repayAmount,
    withdrawAmount,
    withdrawTokenAddress,
  }: RepayAndWithdrawRequest) {
    const { precision, deltaCollAddress, rateRes, minPrice, poolAddress, repayFeeRatio } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts } = positionInfo

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
        toTokenAddress: withdrawTokenAddress === tokens.eth ? tokens.weth : withdrawTokenAddress,
      })
    }

    const debt = cBN(rawDebts).minus(deltaDebt)

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

      targetLeverage = getLeverage(totalSize, debt)
    }

    const payAmount = cBN(deltaDebt)
      .times(1 + Number(repayFeeRatio))
      .toFixed(0)

    const debts = cBN(rawDebts).minus(deltaDebt).toFixed(0)
    const colls = cBN(rawColls).minus(withdrawCollAmount).toFixed(0)

    const minOut = cBN(_toAmount)
      .times(100 - 0.1)
      .div(100)
      .toFixed(0)

    const price = cBN(minPrice).div(PRECISION).toFixed(0, 4)

    const data = [
      {
        tokenIn: tokens.fxUSD,
        amount: payAmount,
        target: contracts.TokenConverter_MultiPathConverter,
        data: encodeFunctionData({
          abi: MultiPathConverterAbi,
          functionName: 'convert',
          args: [
            tokens.fxUSD,
            payAmount,
            0n,
            [],
          ],
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
          minOut,
          signature: '0x',
        }
        : null,
    ]

    const approveTokenTx = await approveToken({
      tokenAddress: tokens.fxUSD,
      amount: repayAmount,
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
      txs.push({
        ...approveTokenTx,
        nonce: nonce++,
        chainId,
      })
    }

    if (approvePositionTx) {
      txs.push({
        ...approvePositionTx,
        nonce: nonce++,
        chainId,
      })
    }

    txs.push({
      type: 'trade',
      from: this.userAddress,
      to: contracts.FxMintRouter,
      data: encodeFunctionData({
        abi: PositionOperateFacetAbi,
        functionName: isZapOut ? 'repayToLongAndZapOut' : 'repayToLong',
        args: data,
      }),
      value: 0n,
      nonce,
      chainId,
    })

    return {
      positionId: this.positionId,
      leverage: targetLeverage,
      executionPrice: price,
      colls: colls,
      debts: debts,
      txs,
    }

  }
}
