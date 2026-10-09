import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  decodeFunctionData,
  encodeFunctionResult,
  multicall3Abi,
  type Abi,
  type Hex,
} from 'viem'
import { Pool } from '../src/core/pool'
import { Price } from '../src/core/price'
import { PoolName } from '../src/types/pool'
import PoolManagerAbi from '../src/abis/PoolManager.json'
import PoolAbi from '../src/abis/AFPool.json'
import PoolConfigurationAbi from '../src/abis/PoolConfiguration.json'
import RateProviderAbi from '../src/abis/RateProvider.json'
import PriceOracleAbi from '../src/abis/PriceOracle.json'

const abis = [
  PoolManagerAbi,
  PoolAbi,
  PoolConfigurationAbi,
  RateProviderAbi,
  PriceOracleAbi,
] as Abi[]

const results: Record<string, unknown> = {
  getPoolInfo: [10n ** 24n, 10n ** 23n, 10n ** 23n, 10n ** 27n, 10n ** 26n],
  paused: false,
  getDebtRatioRange: [5n * 10n ** 17n, 857142857142857142n],
  getPoolFeeRatio: [10n ** 6n, 2n * 10n ** 6n, 0n, 3n * 10n ** 6n],
  getRate: 1200000000000000000n,
  getPrice: [3000n * 10n ** 18n, 2990n * 10n ** 18n, 3010n * 10n ** 18n],
}

// A JSON-RPC node behind the SDK's real viem client: answers each multicall
// and records which calls every eth_call request carried.
const stubNode = () => {
  const requests: string[][] = []
  let inFlight = 0
  let maxInFlight = 0

  const answer = (data: Hex) => {
    for (const abi of abis) {
      let functionName: string
      try {
        functionName = decodeFunctionData({ abi, data }).functionName
      } catch {
        continue
      }
      const returnData = encodeFunctionResult({
        abi,
        functionName,
        result: results[functionName],
      })
      return { functionName, returnData }
    }
    throw new Error(`Unexpected call ${data}`)
  }

  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const { id, method, params } = JSON.parse(init.body as string)
    const call = decodeFunctionData({
      abi: multicall3Abi,
      data: params[0].data,
    })
    if (method !== 'eth_call' || call.functionName !== 'aggregate3') {
      throw new Error(`Unexpected ${method} ${call.functionName}`)
    }
    const answers = call.args[0].map(({ callData }) => answer(callData))
    requests.push(answers.map(({ functionName }) => functionName))

    maxInFlight = Math.max(maxInFlight, ++inFlight)
    await new Promise((resolve) => setTimeout(resolve, 10))
    inFlight--

    const result = encodeFunctionResult({
      abi: multicall3Abi,
      functionName: 'aggregate3',
      result: answers.map(({ returnData }) => ({ success: true, returnData })),
    })
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })

  return { requests, maxInFlight: () => maxInFlight }
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Pool.getPoolInfo reads', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('should send the rate and oracle reads in one multicall alongside the pool data', async () => {
    const node = stubNode()
    vi.spyOn(Price.prototype, 'getBuyPrice').mockResolvedValue('3000')
    vi.spyOn(Price.prototype, 'getSellPrice').mockResolvedValue('2999')

    const poolInfo = await new Pool({ poolName: PoolName.wstETH }).getPoolInfo()

    expect(node.requests).toEqual([
      [
        'getPoolInfo',
        'paused',
        'getDebtRatioRange',
        'getPoolFeeRatio',
        'getPoolFeeRatio',
      ],
      ['getRate', 'getPrice'],
    ])
    expect(node.maxInFlight()).toBe(2)
    expect(poolInfo).toMatchObject({
      poolMaxDebtRatio: 857142857142857142n,
      rateRes: 1200000000000000000n,
      anchorPrice: 3000n * 10n ** 18n,
      minPrice: 2990n * 10n ** 18n,
    })
  })

  it.each([
    { failed: ['oracle', 'rate', 'pool'], error: 'pool' },
    { failed: ['oracle', 'rate'], error: 'rate' },
    { failed: ['pool'], error: 'pool' },
  ])(
    'should surface the $error error when $failed fail',
    async ({ failed, error }) => {
      const pool = new Pool({ poolName: PoolName.wstETH })
      const reads = {
        pool: deferred<Awaited<ReturnType<Pool['getPoolData']>>>(),
        rate: deferred<bigint>(),
        oracle: deferred<Awaited<ReturnType<Price['getOraclePrice']>>>(),
      }
      const started: string[] = []
      // Plain stubs rather than spies, which would handle the rejections
      pool.getPoolData = () => {
        started.push('pool')
        return reads.pool.promise
      }
      pool.price.getRateRes = () => {
        started.push('rate')
        return reads.rate.promise
      }
      pool.price.getOraclePrice = () => {
        started.push('oracle')
        return reads.oracle.promise
      }

      const poolInfo = pool.getPoolInfo()
      expect(started).toEqual(['pool', 'rate', 'oracle'])
      const rejection = expect(poolInfo).rejects.toThrow(error)

      for (const name of failed) {
        reads[name as keyof typeof reads].reject(new Error(name))
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (!failed.includes('pool')) {
        reads.pool.resolve({} as Awaited<ReturnType<Pool['getPoolData']>>)
      }

      await rejection
    }
  )
})
