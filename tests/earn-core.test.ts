import { describe, it, expect } from 'vitest'
import { getGaugeList, earnDeposit, getGaugeBaseInfo, getGaugeApy } from '../src/core/earn'
import type { GaugeBaseInfo } from '../src/types'

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

  describe('getGaugeBaseInfo', () => {
    it('returns gauge base info with weights and rates', async () => {
      const gaugeListResult = await getGaugeList()
      const result = await getGaugeBaseInfo(gaugeListResult.gauges)

      expect(result).toHaveProperty('total_weight')
      expect(result).toHaveProperty('n_gauge_types')
      expect(result).toHaveProperty('FXNRate')
      expect(result).toHaveProperty('GaugeList')
      expect(result).toHaveProperty('typesWeightDatas')

      expect(typeof result.n_gauge_types).toBe('number')
      expect(result.n_gauge_types).toBeGreaterThan(0)
      expect(result.FXNRate).toBeGreaterThan(0n)
      expect(result.GaugeList.length).toBe(gaugeListResult.gauges.length)
      expect(result.typesWeightDatas.length).toBe(result.n_gauge_types)
    }, 60000)

    it('each gauge in GaugeList has weight information', async () => {
      const gaugeListResult = await getGaugeList()
      const result = await getGaugeBaseInfo(gaugeListResult.gauges)

      for (const gauge of result.GaugeList) {
        expect(gauge).toHaveProperty('gauge_weight')
        expect(gauge).toHaveProperty('this_week_gauge_weight')
        expect(gauge).toHaveProperty('next_week_gauge_weight')
        expect(gauge.gauge_weight).toBeGreaterThanOrEqual(0n)
      }
    }, 60000)

    it('typesWeightDatas has correct structure', async () => {
      const gaugeListResult = await getGaugeList()
      const result = await getGaugeBaseInfo(gaugeListResult.gauges)

      for (const typeWeight of result.typesWeightDatas) {
        expect(typeWeight).toHaveProperty('type_weight')
        expect(typeWeight).toHaveProperty('weights_sum_per_type')
        expect(typeWeight.type_weight).toBeGreaterThanOrEqual(0n)
        expect(typeWeight.weights_sum_per_type).toBeGreaterThanOrEqual(0n)
      }
    }, 60000)
  })

  describe('getGaugeApy', () => {
    it('calculates APY with valid inputs', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const result = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 10.0,
        baseInfo,
      })

      expect(result).toHaveProperty('thisWeekApy')
      expect(result).toHaveProperty('nextWeekApy')
      expect(typeof result.thisWeekApy).toBe('string')
      expect(typeof result.nextWeekApy).toBe('string')
    }, 60000)

    it('returns zero APY when TVL is zero', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const result = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 0n,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 10.0,
        baseInfo,
      })

      expect(result.thisWeekApy).toBe('0')
      expect(result.nextWeekApy).toBe('0')
    }, 60000)

    it('returns zero APY when FXN price is zero', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const result = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 0,
        baseInfo,
      })

      expect(result.thisWeekApy).toBe('0')
      expect(result.nextWeekApy).toBe('0')
    }, 60000)

    it('APY increases with higher FXN price', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const result1 = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 5.0,
        baseInfo,
      })

      const result2 = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 10.0,
        baseInfo,
      })

      expect(parseFloat(result2.thisWeekApy)).toBeGreaterThan(parseFloat(result1.thisWeekApy))
    }, 60000)

    it('throws error for invalid gaugeType', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]

      expect(() => {
        getGaugeApy({
          gaugeInfo: {
            ...gaugeInfo,
            totalSupply: 1000000n * ONE_E18,
            gaugeType: 9999, // Invalid type
          },
          lpPrice: 1.0,
          fxnPrice: 10.0,
          baseInfo,
        })
      }).toThrow()
    }, 60000)

    it('handles gaugeType at upper boundary', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const validType = baseInfo.n_gauge_types - 1

      // Should not throw for valid gaugeType at boundary
      const result = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: validType,
        },
        lpPrice: 1.0,
        fxnPrice: 10.0,
        baseInfo,
      })

      expect(result.thisWeekApy).toBeDefined()
      expect(result.nextWeekApy).toBeDefined()
    }, 60000)
  })
})
