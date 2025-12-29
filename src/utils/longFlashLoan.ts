import { cBN } from '@/utils'
import { PoolInfo, PoolName, ConvertData } from '@/types'
import {
  ROUTE_TYPES,
  getRoute,
  getFxUSDByBorrowAmount,
  getBorrowByFxUSDAmount,
} from '@/core/aggregators'
import {
  getRangeWithSlippage,
  getEncodeMiscData,
  getEncodeMiscDataWithSlippage
} from '@/utils'
import { tokens } from '@/configs/tokens'
import { getQueryConvert } from '@/utils/service'
import { RouteResult } from '@/core/aggregators/types'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import {
  PRECISION,
  DEBT_RATIO_SLIPPAGE,
  INT_MIN,
} from '@/configs'
import { contracts } from '@/configs/contracts'
import { encodeAbiParameters, encodeFunctionData } from 'viem'
import { OpenOrAddFlashLoanQuote, CloseOrRemoveFlashLoanQuote } from '@/types/trade'

export const getRouteTargets = (symbol: string, targets: ROUTE_TYPES[]) => {
  if (!targets || (Array.isArray(targets) && targets.length === 0)) {
    return symbol === 'WBTC'
      ? [
        ROUTE_TYPES.FX_ROUTE,
        ROUTE_TYPES.FX_ROUTE_V3,
        ROUTE_TYPES.ODOS,
        ROUTE_TYPES.Velora,
      ]
      : [ROUTE_TYPES.FX_ROUTE, ROUTE_TYPES.ODOS, ROUTE_TYPES.Velora]
  }
  return targets
}

const PLEASE_INCREASE_LEVERAGE =
  'Your xPOSITION leverage is lower than the minimum leverage required, please increase your leverage level.'
const PLEASE_LOWER_LEVERAGE =
  'Your xPOSITION leverage is higher than the maximum leverage allowed, please lower your leverage level.'

const openOrAddFlashLoanQuote = async ({
  tokenAddress,
  positionId,
  amountIn,
  convertInRoute,
  currentColls,
  currentDebts,
  leverage,
  slippage,
  targets = [],
  poolInfo,
}: {
  tokenAddress: string
  positionId: number
  amountIn: bigint
  convertInRoute: ConvertData
  currentColls: bigint
  currentDebts: bigint
  leverage: number
  slippage: number
  targets?: ROUTE_TYPES[]
  poolInfo: PoolInfo
  }) => {
  const {
    poolAddress,
    deltaCollAddress,
    deltaCollSymbol,
    minPrice,
    anchorPrice,
    averagePrice,
    openPrice,
    precision,
    rateRes,
    collRest,
    debtRest,
    openFeeRatio,
    poolMinDebtRatio,
    poolMaxDebtRatio,
  } = poolInfo

  const isBaseToken = tokenAddress === deltaCollAddress

  if (!averagePrice || !anchorPrice) {
    throw Error('Price not found')
  }
  let deltaCollAmountIn = amountIn

  if (!isBaseToken) {
    deltaCollAmountIn = await getQueryConvert(amountIn, convertInRoute)
  }

  const deltaCollAmountInWithSlippage = cBN(deltaCollAmountIn)
    .times(10000 - slippage)
    .div(10000)
    .toFixed(0, 1)

  const hintFxUSDAmount = cBN(deltaCollAmountIn)
    .div(precision)
    .times(PRECISION)
    .times(rateRes)
    .div(PRECISION)
    .plus(currentColls)
    .times(averagePrice)
    .times(leverage - 1)
    .minus(cBN(currentDebts).times(leverage))
    .toFixed(0, 1)

  if (cBN(hintFxUSDAmount).lt(0)) {
    throw Error('Cannot open or add to given leverage')
  }

  const _borrowAmount = cBN(hintFxUSDAmount)
    .times(precision)
    .div(rateRes)
    .div(averagePrice)
    .toFixed(0, 1)

  if (cBN(deltaCollAmountIn).plus(_borrowAmount).gt(collRest)) {
    throw Error(
      'We have reached the xPOSITION cap. Opening positions is temporarily unavailable. Please try again later.'
    )
  }

  const { best, amounts } = await getFxUSDByBorrowAmount({
    hintFxUSDAmount,
    borrowAmount: _borrowAmount,
    baseTokenAddress: deltaCollAddress,
  })

  const { src: _fxUSDAmount } = amounts[best]

  const fxUSDAmount = cBN(_fxUSDAmount)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  const quote = await getRoute({
    src: tokens.fxUSD,
    dst: deltaCollAddress,
    amount: BigInt(fxUSDAmount),
    slippage: slippage / 100,
    receiver: contracts.Router_Diamond,
    targets: getRouteTargets(deltaCollSymbol, targets),
  })

  const { amounts: quoteAmounts } = quote

  const routeList: OpenOrAddFlashLoanQuote[] = []

  const basePrice = openPrice

  let mainError = null

  Object.values(quoteAmounts as Record<ROUTE_TYPES, RouteResult>)
    .sort((a, b) => Number(b.dst) - Number(a.dst))
    .forEach(({ dst, name, to, data: convertData }) => {
      try {
        const borrowAmount = cBN(dst)
          .times(10000 - slippage)
          .div(10000)
          .toFixed(0, 1)

        const curPrice = cBN(fxUSDAmount)
          .div(dst)
          .times(precision)
          .div(rateRes)
          .toString()
        const priceImpact = cBN(curPrice)
          .minus(basePrice)
          .div(basePrice)
          .times(100)
          .toFixed(4, 1)

        if (cBN(fxUSDAmount).gt(debtRest)) {
          throw Error(
            'We have reached the xPOSITION cap. Opening positions is temporarily unavailable. Please try again later.'
          )
        }

        const getTargetDebtRatio = (_price: string | bigint) => {
          return cBN(cBN(currentDebts).plus(fxUSDAmount))
            .times(PRECISION)
            .times(PRECISION)
            .times(PRECISION)
            .div(
              cBN(borrowAmount)
                .plus(cBN(deltaCollAmountIn))
                .div(precision)
                .times(PRECISION)
                .times(1 - openFeeRatio)
                .times(rateRes)
                .plus(cBN(currentColls).times(PRECISION))
                .times(_price)
            )
            .toFixed(0, 1)
        }

        const [min_anchorPrice, max_anchorPrice] = getRangeWithSlippage(
          anchorPrice,
          DEBT_RATIO_SLIPPAGE
        )
        const minDebtRatio = getTargetDebtRatio(max_anchorPrice!)
        const maxDebtRatio = getTargetDebtRatio(min_anchorPrice!)

        const _targetDebtRatio = getTargetDebtRatio(minPrice)

        if (cBN(_targetDebtRatio).lt(poolMinDebtRatio)) {
          throw Error(PLEASE_INCREASE_LEVERAGE)
        }
        if (cBN(_targetDebtRatio).gt(poolMaxDebtRatio)) {
          throw Error(PLEASE_LOWER_LEVERAGE)
        }

        const dataSource = [
          BigInt(getEncodeMiscData(minDebtRatio, maxDebtRatio)),
          BigInt(fxUSDAmount),
          to,
          convertData,
        ] as [bigint, bigint, `0x${string}`, `0x${string}`]

        const data = encodeAbiParameters(
          [
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'address' },
            { type: 'bytes' },
          ],
          dataSource
        )

        const realPrice = cBN(fxUSDAmount)
          .div(borrowAmount)
          .times(precision)
          .div(rateRes)
          .toString()
        


        routeList.push({
          params: {
            routeType: name,
            positionLeverage: leverage,
            minOut: deltaCollAmountInWithSlippage,
            slippage,
            positionId,
            curPrice,
            realPrice,
            priceImpact,
            dataSource,
            colls: cBN(deltaCollAmountIn).plus(borrowAmount).times(1 - openFeeRatio).div(precision).times(PRECISION).plus(currentColls).toFixed(0, 1),
            debts: cBN(fxUSDAmount).plus(currentDebts).toFixed(0, 1),
          },
          data: [
            {
              tokenIn: tokenAddress,
              amount: amountIn,
              target: contracts.TokenConverter_MultiPathConverter,
              data: encodeFunctionData({
                abi: MultiPathConverterAbi,
                functionName: 'convert',
                args: [
                  tokenAddress,
                  amountIn,
                  convertInRoute.encoding,
                  convertInRoute.routes,
                ],
              }),
              minOut: deltaCollAmountInWithSlippage,
              signature: '0x',
            },
            poolAddress,
            positionId,
            borrowAmount,
            data,
          ],
        })
      } catch (err) {
        if (name === ROUTE_TYPES.FX_ROUTE) {
          mainError = err
        }
      }
    })

  if (!routeList.length) {
    throw mainError
  }

  return routeList
}

const closeOrRemoveFlashLoanQuote = async ({
  tokenAddress,
  positionId,
  withdrawDeltaCollAmount,
  convertOutRoute,
  leverage,
  slippage,
  currentColls,
  currentDebts,
  targets = [],
  poolInfo
}: {
  tokenAddress: string
  positionId: number
  withdrawDeltaCollAmount: string
  convertOutRoute: ConvertData
  leverage: number
  slippage: number
  currentColls: bigint
  currentDebts: bigint
  targets?: ROUTE_TYPES[]
  poolInfo: PoolInfo
}) => {
  const {
    poolAddress,
    deltaCollAddress,
    deltaCollSymbol,
    minPrice,
    anchorPrice,
    averagePrice,
    closePrice,
    precision,
    rateRes,
    closeFeeRatio,
    poolMinDebtRatio,
    poolMaxDebtRatio,
  } = poolInfo

  const targetDebtRatio =
    leverage === 0
      ? PRECISION.toString()
      : cBN(leverage).minus(1).div(leverage).times(PRECISION).toFixed(0, 1)

  const isBaseToken = tokenAddress === deltaCollAddress

  const _fxUSDAmount =
    leverage === 0
      ? currentDebts
      : cBN(currentDebts)
        .minus(
          cBN(currentColls)
            .minus(cBN(withdrawDeltaCollAmount).times(rateRes).div(PRECISION))
            .times(averagePrice)
            .times(targetDebtRatio)
            .div(PRECISION)
        )
        .toFixed(0, 1)

  if (cBN(_fxUSDAmount).gt(currentDebts) || cBN(_fxUSDAmount).lt(0)) {
    throw Error('Cannot close or remove given leverage')
  }
  if (leverage === 0) {
    withdrawDeltaCollAmount = cBN(currentColls)
      .times(PRECISION)
      .div(rateRes)
      .toFixed(0, 1)
  }

  const hintDeltaCollToBorrow = cBN(_fxUSDAmount)
    .times(precision)
    .div(cBN(rateRes).times(averagePrice))
    .toFixed(0, 1)

  const searchResult = await getBorrowByFxUSDAmount({
    hintToBorrow: hintDeltaCollToBorrow,
    fxUSDAmount: _fxUSDAmount.toString(),
    baseTokenAddress: deltaCollAddress,
    precision,
  })

  const { best, amounts } = searchResult

  const { src: _deltaCollToBorrow } = amounts[best]

  const deltaCollToBorrow = cBN(_deltaCollToBorrow)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  const quote = await getRoute({
    src: deltaCollAddress,
    dst: tokens.fxUSD,
    amount: BigInt(deltaCollToBorrow),
    slippage: slippage / 100,
    receiver: contracts.Router_Diamond,
    targets: getRouteTargets(deltaCollSymbol, targets),   
  })

  const { amounts: quoteAmounts } = quote

  const routeList: CloseOrRemoveFlashLoanQuote[] = []

  const basePrice = closePrice

  let mainError = null

  for (const item of Object.values(quoteAmounts as Record<ROUTE_TYPES, RouteResult>)) {
    const { dst, name, data: convertData, to } = item

    let newQuoteData

    let _dst = dst

    try {
      const dstAmount = cBN(dst)
        .times(10000 - slippage)
        .div(10000)
        .toFixed(0, 1)

      let fxUSDAmount = dstAmount

      let __deltaCollToBorrow = deltaCollToBorrow

      if (leverage === 0) {
        if (cBN(fxUSDAmount).lt(currentDebts)) {
          // currentDebts / fxUSDAmount = x / deltaCollToBorrow
          __deltaCollToBorrow = cBN(currentDebts)
            .div(fxUSDAmount)
            .times(deltaCollToBorrow)
            .toFixed(0, 1)
        }

        if (cBN(fxUSDAmount).gt(currentDebts)) {
          const formatDeltaCollToBorrow = cBN(currentDebts)
            .times(deltaCollToBorrow)
            .div(dst)
            .toFixed(0, 1)

          const _formatDeltaCollToBorrow = cBN(formatDeltaCollToBorrow)
            .times(10000 + slippage)
            .div(10000)
            .toFixed(0, 1)

          const _quote = await getRoute({
            src: deltaCollAddress,
            dst: tokens.fxUSD,
            amount: BigInt(_formatDeltaCollToBorrow),
            slippage: slippage / 100,
            receiver: contracts.Router_Diamond,
            targets: [name],
          })

          if (_quote.best === name) {
            newQuoteData = _quote.amounts[_quote.best] as RouteResult
            if (cBN(newQuoteData.dst).gt(currentDebts)) {
              __deltaCollToBorrow = _formatDeltaCollToBorrow
            }
          }
        }

        if (
          cBN(__deltaCollToBorrow).gt(
            cBN(currentColls).times(PRECISION).div(rateRes)
          )
        ) {
          throw Error(`${name} quote expired, please go back and retry.`)
        }

        fxUSDAmount = currentDebts.toString()
      }

      _dst = newQuoteData ? newQuoteData.dst : _dst
      const _convertData = newQuoteData ? newQuoteData.data : convertData

      const curPrice = cBN(_dst)
        .div(__deltaCollToBorrow)
        .times(precision)
        .div(rateRes)
        .toString()
      const priceImpact = cBN(basePrice)
        .minus(curPrice)
        .div(basePrice)
        .times(100)
        .toFixed(4, 1)

      const deltaCollExpected = cBN(withdrawDeltaCollAmount)
        .div(PRECISION)
        .times(precision)
        .times(1 - closeFeeRatio)
        .minus(__deltaCollToBorrow)
        .toFixed(0, 1)
        .toString()

      let minOut = BigInt(deltaCollExpected)

      if (cBN(minOut).lt(0)) {
        throw Error('Cannot close or remove given leverage')
      }

      if (!isBaseToken) {
        minOut = await getQueryConvert(minOut, convertOutRoute)
      }

      const _slippage = slippage

      const minOutWithSlippage = cBN(minOut)
        .times(10000 - _slippage)
        .div(10000)
        .toFixed(0, 1)

      const getTargetDebtRatio = (_price: string | bigint) => {
        return leverage === 0
          ? targetDebtRatio
          : cBN(currentDebts)
            .minus(fxUSDAmount)
            .times(PRECISION)
            .times(PRECISION)
            .times(PRECISION)
            .div(
              cBN(currentColls)
                .times(PRECISION)
                .minus(cBN(withdrawDeltaCollAmount).times(rateRes))
                .times(_price)
            )
            .toFixed(0, 1)
      }

      const [min_anchorPrice, max_anchorPrice] = getRangeWithSlippage(
        anchorPrice,
        DEBT_RATIO_SLIPPAGE
      )
      const _targetDebtRatio = getTargetDebtRatio(anchorPrice)
      const minDebtRatio = getTargetDebtRatio(max_anchorPrice!)
      const maxDebtRatio = getTargetDebtRatio(min_anchorPrice!)

      const dataSource = [
        BigInt(leverage === 0
          ? getEncodeMiscDataWithSlippage(
            _targetDebtRatio,
            DEBT_RATIO_SLIPPAGE
          )
          : getEncodeMiscData(minDebtRatio, maxDebtRatio)),
        BigInt(fxUSDAmount),
        to,
        _convertData,
      ] as [bigint, bigint, `0x${string}`, `0x${string}`]

      const data = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'bytes' },
        ],
        dataSource
      )

      if (leverage !== 0) {
        const __targetDebtRatio = getTargetDebtRatio(minPrice)
        if (cBN(__targetDebtRatio).lt(poolMinDebtRatio)) {
          throw Error(
            PLEASE_INCREASE_LEVERAGE
          )
        }
        if (cBN(__targetDebtRatio).gt(poolMaxDebtRatio)) {
          throw Error(
            PLEASE_LOWER_LEVERAGE
          )
        }
      }

      const __deltaCollToWithdraw = cBN(leverage === 0 ? 0 : 1e9)
        .plus(withdrawDeltaCollAmount)
        .times(precision)
        .div(PRECISION)
        .toFixed(0)

      const realPrice = cBN(fxUSDAmount)
        .div(__deltaCollToBorrow)
        .times(precision)
        .div(rateRes)
        .toString()

      routeList.push({
        params: {
          routeType: name,
          minOut: minOutWithSlippage,
          positionLeverage: leverage,
          positionId,
          slippage,
          curPrice,
          realPrice,
          priceImpact,
          dataSource,
          colls: leverage === 0 ? '0' : cBN(currentColls).minus(cBN(withdrawDeltaCollAmount).div(precision).times(rateRes)).toFixed(0, 1),
          debts: leverage === 0 ? '0' : cBN(currentDebts).minus(fxUSDAmount).toFixed(0, 1),
        },
        data: [
          {
            tokenOut: tokenAddress,
            converter: contracts.TokenConverter_MultiPathConverter,
            encodings: convertOutRoute.encoding,
            routes: convertOutRoute.routes,
            minOut: minOutWithSlippage,
            signature: '0x',
          },
          poolAddress,
          positionId,
          leverage === 0 ? INT_MIN : __deltaCollToWithdraw,
          __deltaCollToBorrow,
          data,
        ],
      })
    } catch (err) {
      if (name === ROUTE_TYPES.FX_ROUTE) {
        mainError = err
      }
    }
  }

  if (!routeList.length) {
    throw mainError
  }

  return routeList.sort(
    (a, b) => Number(b.params.minOut) - Number(a.params.minOut)
  )
}


const downLeverageQuote = async ({
    tokenAddress,
    withdrawDeltaCollAmount,
    convertOutRoute,
    leverage,
    slippage,
    currentColls,
    currentDebts,
    positionId,
    targets = [],  
    poolInfo,
  }: {
    tokenAddress: string
    positionId: number
    withdrawDeltaCollAmount: string
    convertOutRoute: ConvertData
    leverage: number
    slippage: number
    currentColls: bigint
    currentDebts: bigint
    targets?: ROUTE_TYPES[]
    poolInfo: PoolInfo
  }) => {
  const {
    poolAddress,
    deltaCollAddress,
    deltaCollSymbol,
    minPrice,
    anchorPrice,
    averagePrice,
    closePrice,
    precision,
    rateRes,
    closeFeeRatio,
    poolMinDebtRatio,
    poolMaxDebtRatio,
  } = poolInfo

    const targetDebtRatio = cBN(leverage)
      .minus(1)
      .div(leverage)
      .times(PRECISION)
      .toFixed(0, 1)

    const rate = rateRes

    const _fxUSDAmount = cBN(currentDebts)
      .minus(
        cBN(currentColls)
          .minus(cBN(withdrawDeltaCollAmount).times(rate).div(PRECISION))
          .times(averagePrice)
          .times(targetDebtRatio)
          .div(PRECISION)
      )
      .toFixed(0, 1)

    if (cBN(_fxUSDAmount).gt(currentDebts) || cBN(_fxUSDAmount).lt(0)) {
      throw Error('Cannot close or remove given leverage')
    }
    const hintDeltaCollToBorrow = cBN(_fxUSDAmount)
      .times(precision)
      .div(cBN(rate).times(averagePrice))
      .toFixed(0, 1)

    const { best, amounts } = await getBorrowByFxUSDAmount({
      hintToBorrow: hintDeltaCollToBorrow,
      fxUSDAmount: _fxUSDAmount,
      baseTokenAddress: deltaCollAddress,
      precision,
    })
    const { src: _deltaCollToBorrow } = amounts[best]

    const deltaCollToBorrow = cBN(_deltaCollToBorrow)
      .times(10000 + slippage)
      .div(10000)
      .toFixed(0, 1)

    const quote = await getRoute({
      src: deltaCollAddress,
      dst: tokens.fxUSD,
      amount: BigInt(deltaCollToBorrow),
      slippage: slippage / 100,
      receiver: contracts.Router_Diamond,
      targets: getRouteTargets(deltaCollSymbol, targets),
    })

    const { amounts: quoteAmounts } = quote

    const routeList: CloseOrRemoveFlashLoanQuote[] = []

    const basePrice = closePrice

    const list = Object.values(quoteAmounts)
      .sort((a, b) => Number(b.dst) - Number(a.dst))

    let mainError = null

    for (const item of list) {
      const { dst, name, data: convertData, to } = item as RouteResult

      try {
        const fxUSDAmount = cBN(dst)
          .times(10000 - slippage)
          .div(10000)
          .toFixed(0, 1)

        const curPrice = cBN(dst)
          .div(deltaCollToBorrow)
          .div(PRECISION)
          .times(precision)
          .div(rate)
          .times(1e18)
          .toString()
        const priceImpact = cBN(curPrice)
          .minus(basePrice)
          .div(basePrice)
          .times(100)
          .toFixed(4, 1)


        withdrawDeltaCollAmount = cBN(deltaCollToBorrow)
          .div(precision)
          .times(PRECISION)
          .div(1 - closeFeeRatio)
          .plus(1e10)
          .toFixed(0)

        // if (
        //   cBN(longPoolTotalRawCollaterals)
        //     .minus(cBN(shortPoolTotalRawDebts).times(rate).div(PRECISION))
        //     .isLessThan(cBN(withdrawDeltaCollAmount).times(rate).div(PRECISION))
        // ) {
        //   throw Error('CollsNotEnough')
        // }

        // eslint-disable-next-line no-loop-func
        const getTargetDebtRatio = (_price: string | bigint) => {
          return cBN(currentDebts)
            .minus(fxUSDAmount)
            .times(PRECISION)
            .times(PRECISION)
            .times(PRECISION)
            .div(
              cBN(currentColls)
                .times(PRECISION)
                .minus(cBN(withdrawDeltaCollAmount).times(rate))
                .times(_price)
            )
            .toFixed(0, 1)
        }

        const [min_anchorPrice, max_anchorPrice] = getRangeWithSlippage(
          anchorPrice,
          DEBT_RATIO_SLIPPAGE
        )
        const minDebtRatio = getTargetDebtRatio(max_anchorPrice!)
        const maxDebtRatio = getTargetDebtRatio(min_anchorPrice!)

        const dataSource = [
          BigInt(getEncodeMiscData(minDebtRatio, maxDebtRatio)),
          BigInt(fxUSDAmount),
          to,
          convertData,
        ] as [bigint, bigint, `0x${string}`, `0x${string}`]

        const data = encodeAbiParameters(
          [
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'address' },
            { type: 'bytes' },
          ],
          dataSource
        )


        const __targetDebtRatio = getTargetDebtRatio(minPrice)

        if (cBN(__targetDebtRatio).lt(poolMinDebtRatio)) {
          throw Error(PLEASE_INCREASE_LEVERAGE)
        }
        if (cBN(__targetDebtRatio).gt(poolMaxDebtRatio)) {
          throw Error(PLEASE_LOWER_LEVERAGE)
        }

        const realPrice = cBN(fxUSDAmount)
          .div(deltaCollToBorrow)
          .times(precision)
          .div(rate)
          .toString()

        const __deltaCollToWithdraw = cBN(withdrawDeltaCollAmount)
          .times(precision)
          .div(PRECISION)
          .toFixed(0)

        routeList.push({
          params: {
            routeType: name,
            minOut: '0',
            positionLeverage: leverage,
            positionId,
            slippage,
            curPrice,
            realPrice,
            priceImpact,
            dataSource,
            colls: cBN(currentColls).minus(cBN(withdrawDeltaCollAmount).div(precision).times(rateRes)).toFixed(0, 1),
            debts: cBN(currentDebts).minus(fxUSDAmount).toFixed(0, 1),
          },
          data: [
            {
              tokenOut: tokenAddress,
              converter: contracts.TokenConverter_MultiPathConverter,
              encodings: convertOutRoute.encoding,
              routes: convertOutRoute.routes,
              minOut: '0',
              signature: '0x',
            },
            poolAddress,
            positionId,
            __deltaCollToWithdraw,
            deltaCollToBorrow,
            data,
          ],
        })
      } catch (err) {
        if (name === ROUTE_TYPES.FX_ROUTE) {
          mainError = err
        }
      }
    }

    if (!routeList.length) {
      throw mainError
    }

    return routeList
  }


export { openOrAddFlashLoanQuote, closeOrRemoveFlashLoanQuote, downLeverageQuote }
