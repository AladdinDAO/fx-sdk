import { cBN, Decimal } from '@/utils'
import { PoolInfo, PoolName } from '@/types'
import {
  getFxUSDByBorrowAmount,
  getRoute,
  ROUTE_TYPES,
} from '@/core/aggregators'
import { getRangeWithSlippage, getEncodeMiscData } from '@/utils'
import { callDecimals } from './call'
import { tokens } from '@/configs/tokens'
import { callQueryConvert } from '@/utils/call'
import { RouteResult } from '@/core/aggregators/types'
import {
  PRECISION,
  CollsNotEnough_Slippage,
  HIGHT_PRICE_IMPACT,
  DEBT_RATIO_SLIPPAGE,
} from '@/configs'
import { contracts } from '@/configs/contracts'

export const getRouteTargets = (poolName: PoolName, targets: ROUTE_TYPES[]) => {
  if (!targets || (Array.isArray(targets) && targets.length === 0)) {
    return poolName === 'WBTC'
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

const processOpenOrAddFlashLoanQuoteData = async ({
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
  convertInRoute: { encoding: bigint; routes: string[] }
  currentColls: bigint
  currentDebts: bigint
  leverage: number
  slippage: number
  targets?: ROUTE_TYPES[]
  poolInfo: PoolInfo
}) => {
  const {
    poolName,
    poolAddress,
    deltaCollAddress,
    minPrice,
    anchorPrice,
    averagePrice,
    openPrice,
    precision,
    rateRes,
    collRest,
    debtRest,
  } = poolInfo

  console.log('processOpenOrAddFlashLoanQuoteData-->', poolInfo)

  const isBaseToken = tokenAddress === deltaCollAddress

  if (!averagePrice || !anchorPrice) {
    throw Error('Price not found')
  }
  let wstETHAmountIn = amountIn

  const fromPrecision = cBN(10).pow(await callDecimals(tokenAddress))

  const isZap = [tokens.usdc, tokens.usdt, tokens.fxUSD].includes(tokenAddress)

  let zapPrice: string
  let minZapAmountPrice: string

  if (!isBaseToken) {
    wstETHAmountIn = await callQueryConvert(amountIn, convertInRoute)

    if (isZap) {
      const fromAmount = fromPrecision.times(100).toString()
      const minAmount = await callQueryConvert(
        BigInt(fromAmount),
        convertInRoute
      )

      minZapAmountPrice = cBN(fromAmount)
        .div(fromPrecision)
        .div(minAmount)
        .times(precision)
        .times(PRECISION)
        .div(rateRes)
        .toString()

      zapPrice = cBN(amountIn)
        .div(fromPrecision)
        .div(wstETHAmountIn)
        .times(precision)
        .times(PRECISION)
        .div(rateRes)
        .toString()
    }
  }

  const wstETHAmountInWithSlippage = cBN(wstETHAmountIn)
    .times(10000 - slippage)
    .div(10000)
    .toFixed(0, 1)

  const hintFxUSDAmount = cBN(wstETHAmountIn)
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

  if (cBN(wstETHAmountIn).plus(_borrowAmount).gt(collRest)) {
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
    targets: getRouteTargets(poolName, targets),
  })

  const { amounts: quoteAmounts } = quote

  console.log('quote-->', quote)

  const routeList = []

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
          .div(PRECISION)
          .div(rateRes)
          .times(1e18)
          .toString()
        const priceImpact = cBN(curPrice)
          .minus(basePrice)
          .div(basePrice)
          .times(100)
          .toFixed(4, 1)

        let minZapPrice
        let zapPriceImpact

        if (isZap) {
          minZapPrice = Decimal.min(minZapAmountPrice, curPrice).toString()
          zapPriceImpact = cBN(zapPrice)
            .minus(minZapPrice)
            .div(minZapPrice)
            .times(100)
            .toFixed(4, 1)
        }

        if (cBN(fxUSDAmount).gt(debtRest)) {
          throw Error(
            JSON.stringify({
              message:
                'We have reached the xPOSITION cap. Opening positions is temporarily unavailable. Please try again later.',
              code: 509,
            })
          )
        }

        const getTargetDebtRatio = (_price: string) => {
          return cBN(cBN(currentDebts).plus(fxUSDAmount))
            .times(PRECISION)
            .times(PRECISION)
            .times(PRECISION)
            .div(
              cBN(borrowAmount)
                .plus(cBN(wstETHAmountIn))
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
        const targetDebtRatio = getTargetDebtRatio(anchorPrice)
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
          getEncodeMiscData(minDebtRatio, maxDebtRatio),
          fxUSDAmount,
          to,
          convertData,
        ]

        const data = web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'address', 'bytes'],
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
            wstETHAmountIn,
            hintFxUSDAmount,
            fxUSDAmount,
            borrowedWstETH: borrowAmount,
            minLeverage: getLeverageByDebtRatio(minDebtRatio),
            maxLeverage: getLeverageByDebtRatio(maxDebtRatio),
            targetLeverage: getLeverageByDebtRatio(targetDebtRatio),
            targetDebtRatio,
            minDebtRatio,
            maxDebtRatio,
            _targetDebtRatio,
            newTargetLeverage: leverage,
            minOut: wstETHAmountInWithSlippage,
            slippage,

            positionId,
            currentColls,
            currentDebts,

            basePrice,
            curPrice,
            realPrice,
            priceImpact,
            isHighPriceImpact: cBN(priceImpact).gt(HIGHT_PRICE_IMPACT),

            dataSource,

            isZap,
            minZapAmountPrice,
            minZapPrice,
            zapPrice,
            zapPriceImpact,
            isHighZapPriceImpact: cBN(zapPriceImpact).gt(HIGHT_PRICE_IMPACT),
          },
          data: [
            {
              tokenIn: tokenAddress,
              amount: amountIn,
              target: contracts.TokenConverter_MultiPathConverter,
              data: multiPathConverterContract.methods
                .convert(
                  tokenAddress,
                  amountIn,
                  convertInRoute.encoding,
                  convertInRoute.routes
                )
                .encodeABI(),
              minOut: wstETHAmountInWithSlippage,
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

export { processOpenOrAddFlashLoanQuoteData }
