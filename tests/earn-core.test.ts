import { describe, it, expect } from 'vitest'
import { getGaugeList, earnDeposit } from '../src/core/earn'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const ONE_E18 = 10n ** 18n

describe('Earn Core', () => {
  describe('getGaugeList', () => {
    it('returns non-empty array of GaugeInfo', async () => {
      const result = await getGaugeList()
      expect(result.gauges.length).toBeGreaterThan(0)
    }, 30000)

    it('all returned gauges have name, gauge, lpAddress fields', async () => {
      const result = await getGaugeList()
      for (const g of result.gauges) {
        expect(g).toHaveProperty('name')
        expect(g).toHaveProperty('gauge')
        expect(g).toHaveProperty('lpAddress')
        expect(typeof g.name).toBe('string')
        expect(g.gauge).toMatch(/^0x[0-9a-fA-F]{40}$/)
        expect(g.lpAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      }
    }, 30000)
  })

  describe('earnDeposit', () => {
    it('returns approve + deposit txs', async () => {
      const gauges = await getGaugeList()
      const gauge = gauges.gauges[0]
      const result = await earnDeposit({
        userAddress: TEST_USER,
        gaugeAddress: gauge.gauge,
        lpTokenAddress: gauge.lpAddress,
        amount: ONE_E18,
      })
      expect(result.txs.length).toBeGreaterThanOrEqual(1)
      const depositTx = result.txs.find((t) => t.type === 'deposit')
      expect(depositTx).toBeDefined()
    }, 60000)

    it('deposit tx targets correct gaugeAddress', async () => {
      const gauges = await getGaugeList()
      const gauge = gauges.gauges[0]
      const result = await earnDeposit({
        userAddress: TEST_USER,
        gaugeAddress: gauge.gauge,
        lpTokenAddress: gauge.lpAddress,
        amount: ONE_E18,
      })
      const depositTx = result.txs.find((t) => t.type === 'deposit')
      expect(depositTx!.to).toBe(gauge.gauge)
    }, 60000)

    it('throws for zero amount', async () => {
      await expect(
        earnDeposit({
          userAddress: TEST_USER,
          gaugeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          lpTokenAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          amount: 0n,
        })
      ).rejects.toThrow()
    })

    it('throws for invalid address', async () => {
      await expect(
        earnDeposit({
          userAddress: 'bad',
          gaugeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          lpTokenAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          amount: ONE_E18,
        })
      ).rejects.toThrow()
    })
  })
})
