import { cBN } from '@/utils'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { Velora } from '@/core/aggregators/velora'
import { Odos } from '@/core/aggregators/odos'
import { FxRoute } from '@/core/aggregators/fxRoute'
import { ROUTE_TYPES } from '@/core/aggregators/types'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { batchedMulticall, MulticallContractCall } from '@/utils/multicall'
import { Abi } from 'viem'
import { QuoteResult, RouteResult } from './types'
import { tokens } from '@/configs/tokens'
import { getZapRoutes } from '@/utils/zapRoute'
export * from './types'

const searchAmount = async (
  left: string,
  right: string,
  expect: string,
  routes: { encoding: bigint; routes: string[] },
  _precision: number
) => {
  let times = 0
  let duration = new Date().getTime()
  while (cBN(left).plus(_precision).lt(right)) {
    const calls: MulticallContractCall[] = []
    const step = cBN(right).minus(left).dividedBy(100).toFixed(0, 1)
    for (let i = 0; i < 100; i++) {
      const amount = cBN(left)
        .plus(cBN(step).times(i + 1))
        .toFixed(0, 1)
      calls.push({
        address: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
        abi: MultiPathConverterAbi as Abi,
        functionName: 'queryConvert',
        args: [amount, routes.encoding, routes.routes],
      })
    }
    if (times === 10) {
      throw Error(
        'Exceeds the maximum trading range. Please lower the position size.'
      )
    }
    console.log('searchAmount--times-----', times)
    times++
    const results = (await batchedMulticall(getClient(), calls)) as {
      result: bigint
    }[]

    for (let i = 0; i < results.length; i++) {
      const { result } = results[i]!
      if (cBN(result).gte(expect)) {
        left = cBN(left).plus(cBN(step).times(i)).toFixed(0, 1)
        right = cBN(left).plus(cBN(step)).toFixed(0, 1)
        break
      }
    }
  }
  duration = new Date().getTime() - duration
  return [left, duration, times]
}

const selectBest = (
  results: QuoteResult[] | RouteResult[],
  reverse?: boolean
) => {
  const amounts = {} as Record<ROUTE_TYPES, QuoteResult | RouteResult>
  let best: ROUTE_TYPES | undefined = undefined

  results.forEach((quote) => {
    amounts[quote.name] = quote
    if (
      !best ||
      (reverse ? quote.dst < amounts[best].dst : quote.dst > amounts[best].dst)
    ) {
      best = quote.name
    }
  })

  if (!best) {
    throw new Error('No best quote found')
  }

  return { best, amounts }
}

const selectTargets = (targets: ROUTE_TYPES[]) => {
  const aggregators = [
    new Velora(),
    new Odos(),
    new FxRoute(),
    new FxRoute(true),
  ]
  const tgtSet = new Set(targets)
  const selected = aggregators.filter((fn) => {
    return targets.length === 0 || tgtSet.has(fn.name as ROUTE_TYPES)
  })
  return selected
}

export const getQuote = async ({
  src,
  dst,
  amount,
  chainId = 1,
  targets = [],
}: {
  src: string
  dst: string
  amount: bigint
  chainId?: number
  targets?: ROUTE_TYPES[]
}) => {
  const _targets = [...targets]
  if (src === tokens.WBTC || dst === tokens.WBTC) {
    if (
      targets.includes(ROUTE_TYPES.FX_ROUTE) &&
      !targets.includes(ROUTE_TYPES.FX_ROUTE_V3)
    ) {
      _targets.push(ROUTE_TYPES.FX_ROUTE_V3)
    }
  }

  const selected = selectTargets(_targets)
  const results = await Promise.allSettled(
    selected.map(async (fn) => {
      return fn.getQuote({ src, dst, amount, chainId })
    })
  )

  return selectBest(
    results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  )
}

export const getRoute = async ({
  src,
  dst,
  amount,
  slippage,
  receiver,
  chainId = 1,
  targets = [],
}: {
  src: string
  dst: string
  amount: bigint
  slippage: number
  receiver: string
  chainId?: number
  targets?: ROUTE_TYPES[]
}) => {
  const selected = selectTargets(targets)
  const results = await Promise.allSettled(
    selected.map(async (fn) => {
      return fn.getRoute({
        src,
        dst,
        amount,
        slippage,
        receiver,
        chainId,
      })
    })
  )
  return selectBest(
    results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  )
}

export const getFxUSDByBorrowAmount = async ({
  hintFxUSDAmount,
  borrowAmount,
  baseTokenAddress,
}: {
  hintFxUSDAmount: string
  borrowAmount: string
  baseTokenAddress: string
}) => {
  const results: QuoteResult[] = []

  const zapRouteData = getZapRoutes({
    fromTokenAddress: tokens.fxUSD,
    toTokenAddress: baseTokenAddress,
  })

  try {
    const [_fxUSDAmount] = await searchAmount(
      cBN(hintFxUSDAmount).times(0.5).toFixed(0, 1),
      cBN(hintFxUSDAmount).times(2).toFixed(0, 1),
      borrowAmount,
      zapRouteData,
      1e16 // Teacher Lin requested modification, 1e16 corresponds to 0.01 fxUSD, preventing issues with small amounts
    )
    results.push({
      name: ROUTE_TYPES.FX_ROUTE,
      src: BigInt(_fxUSDAmount ?? 0n),
      dst: BigInt(borrowAmount),
    })
  } catch (err) {
    // do nothing
  }

  if (baseTokenAddress === tokens.WBTC) {
    const zapRouteData2 = getZapRoutes({
      fromTokenAddress: tokens.fxUSD,
      toTokenAddress: baseTokenAddress,
      isV3: true,
    })

    try {
      const [_fxUSDAmount] = await searchAmount(
        cBN(hintFxUSDAmount).times(0.5).toFixed(0, 1),
        cBN(hintFxUSDAmount).times(2).toFixed(0, 1),
        borrowAmount,
        zapRouteData2,
        1e16 // Teacher Lin requested modification, 1e16 corresponds to 0.01 fxUSD, preventing issues with small amounts
      )
      results.push({
        name: ROUTE_TYPES.FX_ROUTE_V3,
        src: BigInt(_fxUSDAmount ?? 0n),
        dst: BigInt(borrowAmount),
      })
    } catch (err) {
      // do nothing
    }
  }

  if (results.length === 0) {
    throw Error(
      'Exceeds the maximum trading range. Please lower the position size.'
    )
  }

  return selectBest(results, true)
}

/*
export const getBorrowByFxUSDAmount = async ({
  hintWstETHToBorrow,
  fxUSDAmount,
  baseSymbol,
  precision,
}) => {
  const selected = []
  const results = []

  const zapRouteData = getZapRoutes({
    from: baseSymbol,
    to: 'fxUSD',
  })

  const res = await withRetry(async () => {
    const [_wstETHToBorrow] = await searchAmount(
      cBN(hintWstETHToBorrow).times(0.5).toFixed(0, 1),
      cBN(hintWstETHToBorrow).times(2).toFixed(0, 1),
      fxUSDAmount,
      zapRouteData,
      cBN('0.00001').times(precision).toFixed(0, 1)
    )
    selected.push({ name: ROUTE_TYPES.FX_ROUTE })
    results.push({ src: BigInt(_wstETHToBorrow), dst: BigInt(fxUSDAmount) })
  }, 1)
  if (res && res.err && baseSymbol !== 'WBTC') {
    throw Error(
      JSON.stringify({
        message:
          'Exceeds the maximum trading range. Please lower the position size.',
        code: 509,
      })
    )
  }

  if (baseSymbol === 'WBTC') {
    const zapRouteData2 = getZapRoutes({
      from: baseSymbol,
      to: 'fxUSD',
      isV3: true,
    })
    const res2 = await withRetry(async () => {
      const [_wstETHToBorrow] = await searchAmount(
        cBN(hintWstETHToBorrow).times(0.5).toFixed(0, 1),
        cBN(hintWstETHToBorrow).times(2).toFixed(0, 1),
        fxUSDAmount,
        zapRouteData2,
        cBN('0.00001').times(precision).toFixed(0, 1)
      )
      selected.push({ name: ROUTE_TYPES.FX_ROUTE_V3 })
      results.push({
        src: BigInt(_wstETHToBorrow),
        dst: BigInt(fxUSDAmount),
      })
    }, 1)

    if (res2 && res2.err && selected.length === 0) {
      throw Error(
        JSON.stringify({
          message:
            'Exceeds the maximum trading range. Please lower the position size.',
          code: 509,
        })
      )
    }
  }

  return selectBest(selected, results, true)
}

export const getBorrowByUSDCAmount = async ({
  hintWstETHToBorrow,
  usdcAmount,
  baseSymbol,
  precision,
}) => {
  const selected = []
  const results = []

  const zapRouteData = getZapRoutes({
    from: baseSymbol,
    to: 'USDC',
  })

  const res = await withRetry(async () => {
    const [_wstETHToBorrow] = await searchAmount(
      cBN(hintWstETHToBorrow).times(0.5).toFixed(0, 1),
      cBN(hintWstETHToBorrow).times(2).toFixed(0, 1),
      usdcAmount,
      zapRouteData,
      cBN('0.00001').times(precision).toFixed(0, 1)
    )
    selected.push({ name: ROUTE_TYPES.FX_ROUTE })
    results.push({ src: BigInt(_wstETHToBorrow), dst: BigInt(usdcAmount) })
  }, 1)
  if (res && res.err && baseSymbol !== 'WBTC') {
    throw Error(
      JSON.stringify({
        message:
          'Exceeds the maximum trading range. Please lower the position size.',
        code: 509,
      })
    )
  }

  if (baseSymbol === 'WBTC') {
    const zapRouteData2 = getZapRoutes({
      from: baseSymbol,
      to: 'USDC',
      isV3: true,
    })
    const res2 = await withRetry(async () => {
      const [_wstETHToBorrow] = await searchAmount(
        cBN(hintWstETHToBorrow).times(0.5).toFixed(0, 1),
        cBN(hintWstETHToBorrow).times(2).toFixed(0, 1),
        usdcAmount,
        zapRouteData2,
        cBN('0.00001').times(precision).toFixed(0, 1)
      )
      selected.push({ name: ROUTE_TYPES.FX_ROUTE_V3 })
      results.push({ src: BigInt(_wstETHToBorrow), dst: BigInt(usdcAmount) })
    }, 1)

    if (res2 && res2.err && selected.length === 0) {
      throw Error(
        JSON.stringify({
          message:
            'Exceeds the maximum trading range. Please lower the position size.',
          code: 509,
        })
      )
    }
  }

  return selectBest(selected, results, true)
}
*/
