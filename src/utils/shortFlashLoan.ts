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

const PLEASE_INCREASE_LEVERAGE =
  'Your sPOSITION leverage is lower than the minimum leverage required, please increase your leverage level.'
const PLEASE_LOWER_LEVERAGE =
  'Your sPOSITION leverage is higher than the maximum leverage allowed, please lower your leverage level.'

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

const openOrAddShortFlashLoanQuote = async ({
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
    deltaDebtAddress,
    deltaDebtSymbol,
    lsdTokenSymbol,
    minPrice,
    anchorPrice,
    averagePrice,
    openPrice,
    precision,
    rateRes,
    collRest,
    openFeeRatio,
    poolMinDebtRatio,
    poolMaxDebtRatio,
  } = poolInfo

  const isBaseToken = tokenAddress === deltaCollAddress

  if (!averagePrice || !anchorPrice) {
    throw Error('Price not found')
  }

  let fxUSDAmountIn = amountIn

  if (!isBaseToken) {
    fxUSDAmountIn = await getQueryConvert(amountIn, convertInRoute)
  }

  const fxUSDAmountInWithSlippage = cBN(fxUSDAmountIn)
    .times(10000 - slippage)
    .div(10000)
    .toFixed(0, 1)

  const exchangePrice = cBN(1e18).div(averagePrice).toFixed(0, 1)
  const borrowWstETHAmount = cBN(fxUSDAmountIn)
    .plus(currentColls)
    .times(exchangePrice)
    .times(leverage - 1)
    .div(PRECISION)
    .minus(cBN(currentDebts).times(rateRes).div(PRECISION).times(leverage))
    .div(rateRes)
    .times(precision)
    .toFixed(0, 1)

  const wstETHToBorrow = borrowWstETHAmount

  const stETHToBorrow = cBN(wstETHToBorrow)
    .div(precision)
    .times(PRECISION)
    .times(rateRes)
    .div(PRECISION)

  // if (cBN(shortBorrowRest).lt(stETHToBorrow)) {
  //   throw Error(`The amount of ${lsdTokenSymbol} requested exceeds the protocol’s current available borrowing capacity. Only ${
  //         cBN(shortBorrowRest).gt(0)
  //           ? fb4(shortBorrowRest, false, 18, 4)
  //           : '0'
  //       } ${lsdTokenSymbol} can be borrowed at this time. Please adjust your request or try again later.`
  //   )
  // }

  const quote = await getRoute({
    src: deltaDebtAddress,
    dst: tokens.fxUSD,
    amount: BigInt(wstETHToBorrow),
    slippage: slippage / 100,
    receiver: contracts.Router_Diamond,
    targets: getRouteTargets(deltaDebtSymbol, targets),
  })

  const { amounts: quoteAmounts } = quote

  const routeList: OpenOrAddFlashLoanQuote[] = []

  const basePrice = openPrice

  let mainError = null

  Object.values(quoteAmounts)
    .sort((a, b) => Number(b.dst) - Number(a.dst))
    .forEach((item) => {
      const { dst, name, to, data: convertData } = item as RouteResult
      try {
        const fxUSDAmount = cBN(dst)
          .times(10000 - slippage)
          .div(10000)
          .toFixed(0, 1)

        const curPrice = cBN(dst)
          .div(wstETHToBorrow)
          .div(PRECISION)
          .times(precision)
          .div(rateRes)
          .times(1e18)
          .toString()
        const priceImpact = cBN(basePrice)
          .minus(curPrice)
          .div(basePrice)
          .times(100)
          .toFixed(4, 1)

        if (cBN(fxUSDAmount).gt(collRest)) {
          throw Error(
            'We have reached the sPOSITION cap. Opening positions is temporarily unavailable. Please try again later.'
          )
        }

        const getTargetDebtRatio = (_price: string | bigint) => {
          return cBN(currentDebts)
            .plus(cBN(wstETHToBorrow).div(precision).times(PRECISION))
            .times(PRECISION)
            .times(PRECISION)
            .div(
              cBN(fxUSDAmountIn)
                .plus(fxUSDAmount)
                .times(1 - openFeeRatio)
                .plus(currentColls)
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
          throw Error(
            JSON.stringify({
              message: PLEASE_INCREASE_LEVERAGE,
              code: 509,
            })
          )
        }
        if (cBN(_targetDebtRatio).gt(poolMaxDebtRatio)) {
          throw Error(
            JSON.stringify({
              message: PLEASE_LOWER_LEVERAGE,
              code: 509,
            })
          )
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
          .div(wstETHToBorrow)
          .times(precision)
          .div(rateRes)
          .toString()

        routeList.push({
          params: {
            routeType: name,
            positionLeverage: leverage - 1 ,
            minOut: fxUSDAmountInWithSlippage,
            slippage,
            positionId,
            curPrice,
            realPrice,
            priceImpact,
            dataSource,
            colls: cBN(fxUSDAmountIn).plus(fxUSDAmount).times(1 - openFeeRatio).plus(currentColls).toFixed(0, 1),
            debts: cBN(wstETHToBorrow).div(precision).times(PRECISION).plus(currentDebts).toFixed(0, 1),
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
              minOut: fxUSDAmountInWithSlippage,
              signature: '0x',
            },
            poolAddress,
            positionId,
            wstETHToBorrow,
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

const closeOrRemoveShortFlashLoanQuote = async ({
  tokenAddress,
  positionId,
  withdrawDeltaCollAmount: fxUSDToWithdraw,
  convertOutRoute,
  leverage,
  slippage,
  currentColls,
  currentDebts,
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
    deltaDebtAddress,
    deltaDebtSymbol,
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
      ? PRECISION
      : cBN(leverage).minus(1).div(leverage).times(PRECISION).toFixed(0, 1)

  const isDeltaColl = tokenAddress === deltaCollAddress

  const rate = rateRes

  const fxUSDAmount = leverage === 0 ? currentColls.toString() : fxUSDToWithdraw

  const exchangePrice = cBN(1e18).div(averagePrice)
  const wstETHAmount = cBN(
    leverage === 0
      ? currentDebts
      : cBN(currentDebts).minus(
        cBN(currentColls)
          .minus(fxUSDAmount)
          .times(exchangePrice)
          .times(targetDebtRatio)
          .div(PRECISION)
          .div(PRECISION)
          .times(PRECISION)
          .div(rate)
      )
  )
    .div(PRECISION)
    .times(precision)
    .toFixed(0, 1)

  if (cBN(fxUSDAmount).gt(currentColls) || cBN(wstETHAmount).lt(0)) {
    throw Error('cannot remove or close to given leverage')
  }

  const hintFxUSDToSwap = cBN(wstETHAmount)
    .div(precision)
    .times(PRECISION)
    .times(rate)
    .div(exchangePrice)
    .toFixed(0, 1)

  const { best, amounts } = await getFxUSDByBorrowAmount({
    hintFxUSDAmount: hintFxUSDToSwap,
    borrowAmount: wstETHAmount,
    baseTokenAddress: deltaDebtAddress,
  })

  const { src: _fxUSDToSwap } = amounts[best]

  const fxUSDToSwap = cBN(_fxUSDToSwap)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  const quote = await getRoute({
    src: tokens.fxUSD,
    dst: deltaDebtAddress,
    amount: BigInt(fxUSDToSwap),
    slippage: slippage / 100,
    receiver: contracts.Router_Diamond,
    targets: getRouteTargets(deltaDebtSymbol, targets),
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
      const wstETHToBorrow =
        leverage === 0
          ? cBN(wstETHAmount).plus(1).toFixed(0)
          : cBN(dst)
            .times(10000 - slippage)
            .div(10000)
            .toFixed(0, 1)

      const curPrice = cBN(fxUSDToSwap)
        .div(dst)
        .times(precision)
        .div(PRECISION)
        .div(rateRes)
        .times(1e18)
        .toString()

      const priceImpact = cBN(curPrice)
        .minus(basePrice)
        .div(basePrice)
        .times(100)
        .toFixed(4, 1)

      const fxUSDExpected = cBN(fxUSDAmount)
        .times(1 - closeFeeRatio)
        .minus(fxUSDToSwap)
        .toFixed(0, 1)
        .toString()

      let minOut = BigInt(fxUSDExpected)

      if (cBN(minOut).lt(0)) {
        throw Error('Cannot close or remove given leverage')
      }

      if (!isDeltaColl) {
        minOut = await getQueryConvert(minOut, convertOutRoute)
      }

      const minOutWithSlippage = cBN(minOut)
        .times(10000 - slippage)
        .div(10000)
        .toFixed(0, 1)

      const getTargetDebtRatio = (_price: string | bigint) => {
        return leverage === 0
          ? targetDebtRatio.toString()
          : cBN(currentDebts)
            .minus(cBN(wstETHToBorrow).div(precision).times(PRECISION))
            .times(PRECISION)
            .times(PRECISION)
            .div(cBN(currentColls).minus(fxUSDAmount).times(_price))
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
        BigInt(fxUSDToSwap),
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

      const realPrice = cBN(fxUSDAmount)
        .div(wstETHToBorrow)
        .times(precision)
        .div(rateRes)
        .toString()

      routeList.push({
        params: {
          routeType: name,
          positionId,
          minOut: minOutWithSlippage,
          positionLeverage: leverage - 1,
          slippage,
          curPrice,
          realPrice,
          priceImpact,
          dataSource,
          colls: leverage === 0 ? '0' : cBN(currentColls).minus(fxUSDAmount).toFixed(0, 1),
          debts: leverage === 0 ? '0' : cBN(currentDebts).minus(cBN(wstETHToBorrow).div(precision).times(1e18)).toFixed(0, 1),
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
          leverage === 0 ? INT_MIN : fxUSDAmount,
          wstETHToBorrow,
          data,
        ],
      })
    } catch (err) {
      console.log('err------', name, err)
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

const downLeverageShortFlashLoanQuote = async ({
  tokenAddress,
  withdrawDeltaCollAmount: fxUSDToWithdraw,
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
  withdrawDeltaCollAmount: string
  convertOutRoute: ConvertData
  leverage: number
  slippage: number
  currentColls: bigint
  currentDebts: bigint
  positionId: number
  targets?: ROUTE_TYPES[]
  poolInfo: PoolInfo
}) => {
  const {
    poolAddress,
    deltaCollAddress,
    deltaDebtAddress,
    deltaDebtSymbol,
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


  const fxUSDAmount = fxUSDToWithdraw

  const exchangePrice = cBN(1e18).div(averagePrice)
  const wstETHAmount = cBN(currentDebts)
    .minus(
      cBN(currentColls)
        .minus(fxUSDAmount)
        .times(exchangePrice)
        .times(targetDebtRatio)
        .div(PRECISION)
        .div(PRECISION)
        .times(PRECISION)
        .div(rate)
    )
    .div(PRECISION)
    .times(precision)
    .toFixed(0, 1)


  const hintFxUSDToSwap = cBN(wstETHAmount)
    .div(precision)
    .times(PRECISION)
    .times(rate)
    .div(exchangePrice)
    .toFixed(0, 1)

  const { best, amounts } = await getFxUSDByBorrowAmount({
    hintFxUSDAmount: hintFxUSDToSwap,
    borrowAmount: wstETHAmount,
    baseTokenAddress: deltaDebtAddress,
  })

  const { src: _fxUSDToSwap } = amounts[best]

  const fxUSDToSwap = cBN(_fxUSDToSwap)
    .times(10000 + slippage)
    .div(10000)
    .toFixed(0, 1)

  const quote = await getRoute({
    src: tokens.fxUSD,
    dst: deltaDebtAddress,
    amount: BigInt(fxUSDToSwap),
    slippage: slippage / 100,
    receiver: contracts.Router_Diamond,
    targets: getRouteTargets(deltaDebtSymbol, targets),
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
      const wstETHToBorrow = cBN(dst)
        .times(10000 - slippage)
        .div(10000)
        .toFixed(0, 1)

      const curPrice = cBN(fxUSDToSwap)
        .div(dst)
        .times(precision)
        .div(PRECISION)
        .div(rateRes)
        .times(1e18)
        .toString()

      const priceImpact = cBN(curPrice)
        .minus(basePrice)
        .div(basePrice)
        .times(100)
        .toFixed(4, 1)

      const _fxUSDAmount = cBN(fxUSDToSwap)
        .div(1 - closeFeeRatio)
        .plus(1e10)
        .toFixed(0)

      // eslint-disable-next-line no-loop-func
      const getTargetDebtRatio = (_price: string | bigint) => {
        return cBN(currentDebts)
          .minus(cBN(wstETHToBorrow).div(precision).times(PRECISION))
          .times(PRECISION)
          .times(PRECISION)
          .div(cBN(currentColls).minus(_fxUSDAmount).times(_price))
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
        BigInt(getEncodeMiscData(minDebtRatio, maxDebtRatio)),
        BigInt(fxUSDToSwap),
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
        throw Error(
          PLEASE_INCREASE_LEVERAGE
        )
      }
      if (cBN(__targetDebtRatio).gt(poolMaxDebtRatio)) {
        throw Error(
          PLEASE_LOWER_LEVERAGE
        )
      }

      const realPrice = cBN(_fxUSDAmount)
        .div(wstETHToBorrow)
        .times(precision)
        .div(rateRes)
        .toString()

      routeList.push({
        params: {
          routeType: name,
          positionLeverage: leverage - 1,
          positionId,
          minOut: '0',
          slippage,
          curPrice,
          realPrice,
          priceImpact,
          dataSource,
          colls: cBN(currentColls).minus(_fxUSDAmount).toFixed(0, 1),
          debts: cBN(currentDebts).minus(cBN(wstETHToBorrow).div(precision).times(1e18)).toFixed(0, 1),
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
          _fxUSDAmount,
          wstETHToBorrow,
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

export { openOrAddShortFlashLoanQuote, closeOrRemoveShortFlashLoanQuote, downLeverageShortFlashLoanQuote }