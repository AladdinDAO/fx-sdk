import { describe, it, expect } from 'vitest'
import { cBN } from '../src/utils'
import { getZapRoutes } from '../src/utils/zapRoute'
import { tokens } from '../src/configs/tokens'
import { searchAmount, searchAmountIn } from '../src/core/aggregators'

describe('searchAmount vs searchAmountIn', () => {

  const convertData = getZapRoutes({
    fromTokenAddress: tokens.fxUSD,
    toTokenAddress: tokens.wstETH,
  })

  const precision = 1e16

  const cases = [
    {
      label: '1 wstETH',
      expectOutput: cBN(1).times(1e18).toFixed(0),
      lo: cBN(1000).times(1e18).toFixed(0),
      hi: cBN(10000).times(1e18).toFixed(0),
    },
    {
      label: '100 wstETH',
      expectOutput: cBN(100).times(1e18).toFixed(0),
      lo: cBN(100000).times(1e18).toFixed(0),
      hi: cBN(1000000).times(1e18).toFixed(0),
    },
  ]

  it(
    'comparison table',
    async () => {
      const data: {
        label: string
        offChainInput: string
        offChainDuration: number
        offChainIterations: number
        offChainQueries: number
        onChainInput: string
        onChainDuration: number
        onChainSamples: number
        diffFxUSD: string
        diffPct: string
      }[] = []

      for (const { label, expectOutput, lo, hi } of cases) {
        const t0 = Date.now()
        const onChain = await searchAmountIn(lo, hi, expectOutput, convertData, precision, 50)
        const onChainDuration = Date.now() - t0

        const [offChainInput, offChainDuration, offChainIterations] = await searchAmount(
          lo, hi, expectOutput, convertData, precision
        )

        const diff = cBN(offChainInput!).minus(onChain.input.toString()).abs()
        const diffPct = diff.div(cBN(offChainInput!).abs()).times(100)

        data.push({
          label,
          offChainInput: cBN(offChainInput!).div(1e18).toFixed(4),
          offChainDuration: offChainDuration as number,
          offChainIterations: offChainIterations as number,
          offChainQueries: (offChainIterations as number) * 100,
          onChainInput: cBN(onChain.input.toString()).div(1e18).toFixed(4),
          onChainDuration,
          onChainSamples: onChain.samples.length,
          diffFxUSD: diff.div(1e18).toFixed(6),
          diffPct: diffPct.toFixed(4),
        })
      }

      console.log('')
      console.log('┌─────────────┬────────────────────────────────────────────────────┬──────────────────────────────────────────┬──────────────────────┐')
      console.log('│             │ Off-chain (searchAmount)                            │ On-chain (searchAmountIn)                 │ Diff                 │')
      console.log('├─────────────┼──────────────┬──────────┬────────────┬─────────────┼──────────────┬──────────┬─────────────────┼───────────┬──────────┤')
      console.log('│ Expect      │ Input (fxUSD)│ Duration │ Iterations │ Queries     │ Input (fxUSD)│ Duration │ Samples         │ fxUSD     │ %        │')
      console.log('├─────────────┼──────────────┼──────────┼────────────┼─────────────┼──────────────┼──────────┼─────────────────┼───────────┼──────────┤')
      for (const d of data) {
        console.log(
          `│ ${d.label.padEnd(11)} │ ${d.offChainInput.padStart(12)} │ ${(d.offChainDuration + 'ms').padStart(8)} │ ${String(d.offChainIterations).padStart(10)} │ ${String(d.offChainQueries).padStart(11)} │ ${d.onChainInput.padStart(12)} │ ${(d.onChainDuration + 'ms').padStart(8)} │ ${String(d.onChainSamples).padStart(15)} │ ${d.diffFxUSD.padStart(9)} │ ${(d.diffPct + '%').padStart(8)} │`
        )
      }
      console.log('└─────────────┴──────────────┴──────────┴────────────┴─────────────┴──────────────┴──────────┴─────────────────┴───────────┴──────────┘')

      for (const d of data) {
        expect(parseFloat(d.diffPct)).toBeLessThan(1)
      }
    },
    600000
  )

  const precisions = [1, 10, 100, 1e3, 1e4, 1e6, 1e8, 1e9, 1e10, 1e12, 1e13, 1e14, 1e15, 1e16]

  it(
    'precision table (1 wstETH)',
    async () => {
      const expectOutput = cBN(1).times(1e18).toFixed(0)
      const lo = cBN(1000).times(1e18).toFixed(0)
      const hi = cBN(10000).times(1e18).toFixed(0)

      console.log('\n--- searchAmountIn precision sweep (expect: 1 wstETH) ---')
      console.log(
        `${'Precision'.padEnd(16)} | ${'Input (fxUSD)'.padEnd(30)} | ${'Output (wstETH)'.padEnd(30)} | Samples`
      )
      console.log('-'.repeat(95))

      for (const p of precisions) {
        const result = await searchAmountIn(lo, hi, expectOutput, convertData, p, 50)

        const inputStr = cBN(result.input.toString()).div(1e18).toFixed(18)
        const outputStr = cBN(result.output.toString()).div(1e18).toFixed(18)
        console.log(
          `${p.toExponential().padEnd(16)} | ${inputStr.padEnd(30)} | ${outputStr.padEnd(30)} | ${result.samples.length}`
        )

        expect(result.input).toBeGreaterThan(0n)
        expect(result.output).toBeGreaterThanOrEqual(BigInt(expectOutput))
      }
    },
    300000
  )
})
