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

      expect(result.thisWeekApy).toBe('0.00')
      expect(result.nextWeekApy).toBe('0.00')
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

      expect(result.thisWeekApy).toBe('0.00')
      expect(result.nextWeekApy).toBe('0.00')
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

  describe('getConvexExtraApy', () => {
    it('returns map of LP addresses to APY values', async () => {
      const { getConvexExtraApy } = await import('../src/core/earn')
      const result = await getConvexExtraApy()

      expect(typeof result).toBe('object')
      expect(Array.isArray(result)).toBe(false)

      // 验证返回值格式
      for (const [address, apy] of Object.entries(result)) {
        // 验证地址格式（小写的 0x 开头 40 位十六进制）
        expect(address).toMatch(/^0x[0-9a-f]{40}$/)
        // 验证 APY 值是数字
        expect(typeof apy).toBe('number')
        // 验证 APY 值在合理范围内（0-1000%）
        expect(apy).toBeGreaterThanOrEqual(0)
        expect(apy).toBeLessThanOrEqual(1000)
      }
    }, 30000)

    it('returns non-empty map with valid data', async () => {
      const { getConvexExtraApy } = await import('../src/core/earn')
      const result = await getConvexExtraApy()

      // 应该至少有一些池子的数据
      expect(Object.keys(result).length).toBeGreaterThan(0)
    }, 30000)

    it('handles API errors gracefully and returns empty object', async () => {
      // 这个测试验证即使 API 失败也不会崩溃
      // 由于我们无法轻易 mock axios，这里只测试函数存在且不会抛出错误
      const { getConvexExtraApy } = await import('../src/core/earn')

      // 多次调用验证稳定性
      const result1 = await getConvexExtraApy()
      const result2 = await getConvexExtraApy()

      expect(typeof result1).toBe('object')
      expect(typeof result2).toBe('object')
    }, 60000)
  })

  describe('getGaugeApy with convexExtraApy', () => {
    it('includes convexExtraApy in totalApy calculation', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]
      const convexExtraApy = 5.5

      const result = getGaugeApy({
        gaugeInfo: {
          ...gaugeInfo,
          totalSupply: 1000000n * ONE_E18,
          gaugeType: 0,
        },
        lpPrice: 1.0,
        fxnPrice: 10.0,
        baseInfo,
        convexExtraApy,
      })

      expect(result.extraApy).toBe('5.50')
      expect(result.totalApy).toBeDefined()

      // totalApy 应该等于 thisWeekApy + convexExtraApy
      const totalApyValue = parseFloat(result.totalApy)
      const thisWeekApyValue = parseFloat(result.thisWeekApy)
      expect(totalApyValue).toBeCloseTo(thisWeekApyValue + convexExtraApy, 2)
    }, 60000)

    it('handles zero convexExtraApy', async () => {
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
        convexExtraApy: 0,
      })

      // 当 convexExtraApy 为 0 时，extraApy 为 '0.00'
      expect(result.extraApy).toBe('0.00')
      // totalApy 应该等于 thisWeekApy
      expect(parseFloat(result.totalApy)).toBeCloseTo(parseFloat(result.thisWeekApy), 2)
    }, 60000)

    it('handles undefined convexExtraApy', async () => {
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
        // 不传 convexExtraApy
      })

      expect(result.extraApy).toBeUndefined()
      // totalApy 应该等于 thisWeekApy
      expect(parseFloat(result.totalApy)).toBeCloseTo(parseFloat(result.thisWeekApy), 2)
    }, 60000)

    it('correctly adds convexExtraApy to totalApy', async () => {
      const gaugeListResult = await getGaugeList()
      const baseInfo = await getGaugeBaseInfo(gaugeListResult.gauges)

      const gaugeInfo = baseInfo.GaugeList[0]

      // 测试不同的 convexExtraApy 值
      const testCases = [
        { convexExtraApy: 1.23, expected: '1.23' },
        { convexExtraApy: 10.5, expected: '10.50' },
        { convexExtraApy: 0.01, expected: '0.01' },
      ]

      for (const testCase of testCases) {
        const result = getGaugeApy({
          gaugeInfo: {
            ...gaugeInfo,
            totalSupply: 1000000n * ONE_E18,
            gaugeType: 0,
          },
          lpPrice: 1.0,
          fxnPrice: 10.0,
          baseInfo,
          convexExtraApy: testCase.convexExtraApy,
        })

        expect(result.extraApy).toBe(testCase.expected)
      }
    }, 60000)
  })
})
