import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PublicClient } from 'viem'
import { batchedMulticall, MulticallContractCall } from '../src/utils/multicall'
import {
  getBorrowByFxUSDAmount,
  getFxUSDByBorrowAmount,
} from '../src/core/aggregators'
import { tokens } from '../src/configs/tokens'

const client = vi.hoisted(() => ({ multicall: vi.fn() }))
vi.mock('../src/core/client', () => ({ getClient: () => client }))

const HINT = '100000000000000000000'

// Each multicall takes 100ms and answers queryConvert(amount) with amount
const timeline = async (run: () => Promise<unknown>) => {
  const t0 = Date.now()
  const requests: { start: number; end: number }[] = []
  client.multicall.mockImplementation(
    async ({ contracts }: { contracts: MulticallContractCall[] }) => {
      const request = { start: Date.now() - t0, end: 0 }
      requests.push(request)
      await new Promise((resolve) => setTimeout(resolve, 100))
      request.end = Date.now() - t0
      return contracts.map(({ args }) => ({ result: BigInt(`${args![0]}`) }))
    }
  )

  let resolvedAt = 0
  const done = run().then((result) => {
    resolvedAt = Date.now() - t0
    return result
  })
  await vi.runAllTimersAsync()
  const result = await done
  return { requests, resolvedAt, result }
}

describe('multicall delay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  it('should wait between batches but not after the last one', async () => {
    const calls = Array.from({ length: 101 }, (_, i) => ({
      address: tokens.fxUSD as `0x${string}`,
      abi: [],
      functionName: 'queryConvert',
      args: [i],
    }))

    const { requests, resolvedAt, result } = await timeline(() =>
      batchedMulticall(client as unknown as PublicClient, calls)
    )

    expect(requests).toEqual([
      { start: 0, end: 100 },
      { start: 600, end: 700 },
      { start: 1200, end: 1300 },
    ])
    expect(resolvedAt).toBe(1300)
    expect(result).toEqual(calls.map((_, i) => ({ result: BigInt(i) })))
  })

  it.each([
    {
      name: 'getFxUSDByBorrowAmount',
      quote: () =>
        getFxUSDByBorrowAmount({
          hintFxUSDAmount: HINT,
          borrowAmount: HINT,
          baseTokenAddress: tokens.WBTC,
        }),
    },
    {
      name: 'getBorrowByFxUSDAmount',
      quote: () =>
        getBorrowByFxUSDAmount({
          hintToBorrow: '100000000',
          fxUSDAmount: '100000000',
          baseTokenAddress: tokens.WBTC,
          precision: 1e8,
        }),
    },
  ])(
    'should keep the delay between all requests of $name but not after the last one',
    async ({ quote }) => {
      const { requests, resolvedAt, result } = await timeline(quote)

      // Three iterations of two batches for each of the V2 and V3 routes
      expect(requests.map(({ start }) => start)).toEqual(
        Array.from({ length: 12 }, (_, i) => i * 600)
      )
      expect(resolvedAt).toBe(requests[11]!.end)
      expect(Object.keys((result as { amounts: object }).amounts)).toEqual([
        'FxRoute',
        'FxRoute 2',
      ])
    }
  )
})
