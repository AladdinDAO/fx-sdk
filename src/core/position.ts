import AFPoolAbi from '@/abis/AFPool.json'
import { IncreasePositionRequest, PoolInfo } from '@/types'
import { FxRoute } from '@/core/aggregators/fxRoute'
import { tokens } from '@/configs/tokens'
import { cBN, getLeverage } from '@/utils'
import { getClient } from '@/core/client'
import { processOpenOrAddFlashLoanQuoteData } from '@/utils/longFlashLoan'

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
      ? cBN(rawDebts).times(rateRes).div(1e18).toFixed(0)
      : rawDebts

    const currentSize = cBN(_rawColls)
      .times(isShort ? 1 : price)
      .toFixed(0)

    const debtUsd = cBN(_rawDebts)
      .times(isShort ? price : 1)
      .toFixed(0)

    const currentLeverage = getLeverage(currentSize, debtUsd)

    // const debtRatio = await this.client.readContract({
    //   address: this.poolInfo.poolAddress as `0x${string}`,
    //   abi: AFPoolAbi,
    //   functionName: "getPositionDebtRatio",
    //   args: [this.positionId],
    // });
    return { rawColls, rawDebts, currentLeverage }
  }

  async increasePosition({
    fromAmount,
    fromTokenAddress,
    leverage,
    slippage,
    targets,
  }: IncreasePositionRequest) {
    const { isShort, precision, deltaCollAddress, rateRes } = this.poolInfo

    const positionInfo = await this.getPositionInfo()
    const { rawColls, rawDebts, currentLeverage } = positionInfo
    console.log('positionInfo-->', positionInfo)

    try {
      let _leverage = isShort ? leverage + 1 : leverage
      let _deltaCollAmount = fromAmount
      let convertInRoute = {
        encoding: 0n,
        routes: [] as string[],
      }

      if (fromTokenAddress !== deltaCollAddress) {
        const fxRoute = new FxRoute()
        const quote = await fxRoute.getQuote({
          src: fromTokenAddress === tokens.eth ? tokens.weth : fromTokenAddress,
          dst: deltaCollAddress,
          amount: fromAmount,
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
            .times(1e18)
            .times(_leverage)
            .times(rateRes)
            .div(1e18)
            .plus(rawColls)
            .times(currentLeverage)
          const b = cBN(_deltaCollAmount)
            .div(precision)
            .times(1e18)
            .times(currentLeverage)
            .times(rateRes)
            .div(1e18)
            .plus(rawColls)
          _leverage = a.div(b).toNumber()
        }
      }

      // const quoteFunc = isShort
      //   ? processOpenOrAddShortFlashLoanQuoteData
      //   : processOpenOrAddFlashLoanQuoteData
      const quoteFunc = processOpenOrAddFlashLoanQuoteData

      const routeList = await quoteFunc({
        tokenAddress: fromTokenAddress,
        positionId: this.positionId,
        amountIn: fromAmount,
        convertInRoute,
        currentColls: rawColls,
        currentDebts: rawDebts,
        leverage: _leverage,
        slippage: slippage * 100,
        targets,
        poolInfo: this.poolInfo,
      })

      // const info = routeList.find(
      //   (item) => item.params.routeType === routeType
      // );
      // if (!info || !showRouteCard || !showModal) {
      //   setRouteType(routeList[0].params.routeType);
      // }

      // const processTradeInfoFunc = isShort
      //   ? processShortTradeInfo
      //   : processTradeInfo;

      // setRoutes(
      //   routeList.map((item) => ({
      //     ...item.params,
      //     ...processTradeInfoFunc(item.params, item.data),
      //   }))
      // );
    } catch (error) {}
  }

  decreasePosition(positionId: string) {
    //
  }

  closePosition(positionId: string) {
    //
  }
}
