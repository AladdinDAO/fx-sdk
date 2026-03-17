import { describe, it, expect } from 'vitest'
import {
  getGaugeList,
  getEarnPosition,
  earnWithdraw,
  claimFxn,
  claimRewards,
} from '../src/core/earn'
import { contracts } from '../src/configs/contracts'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const ONE_E18 = 10n ** 18n

describe('Earn Remaining Methods', () => {
  let testGaugeAddress: string

  // Fetch a real gauge address for tests
  beforeAll(async () => {
    const result = await getGaugeList()
    testGaugeAddress = result.gauges[0].gauge
  }, 30000)

  describe('getEarnPosition', () => {
    it('returns stakedBalance and pendingFxn', async () => {
      const result = await getEarnPosition({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(result).toHaveProperty('stakedBalance')
      expect(result).toHaveProperty('pendingFxn')
      expect(result).toHaveProperty('pendingRewards')
      expect(typeof result.stakedBalance).toBe('bigint')
      expect(typeof result.pendingFxn).toBe('bigint')
    }, 30000)

    it('throws for invalid user address', async () => {
      await expect(
        getEarnPosition({
          userAddress: 'bad',
          gaugeAddress: testGaugeAddress,
        })
      ).rejects.toThrow()
    })

    it('throws for invalid gauge address', async () => {
      await expect(
        getEarnPosition({
          userAddress: TEST_USER,
          gaugeAddress: 'bad',
        })
      ).rejects.toThrow()
    })
  })

  describe('earnWithdraw', () => {
    it('returns withdraw tx (no approve)', async () => {
      const result = await earnWithdraw({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
        amount: ONE_E18,
      })
      expect(result.txs.length).toBe(1)
      const tx = result.txs[0]
      expect(tx.type).toBe('withdraw')
      expect(tx.to).toBe(testGaugeAddress)
    }, 30000)

    it('throws for zero amount', async () => {
      await expect(
        earnWithdraw({
          userAddress: TEST_USER,
          gaugeAddress: testGaugeAddress,
          amount: 0n,
        })
      ).rejects.toThrow()
    })
  })

  describe('claimFxn', () => {
    it('returns FXNTokenMinter.mint tx', async () => {
      const result = await claimFxn({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(result.txs.length).toBe(1)
      const tx = result.txs[0]
      expect(tx.type).toBe('claimFxn')
      expect(tx.to).toBe(contracts.FXN_TokenMinter)
    }, 30000)

    it('throws for invalid user address', async () => {
      await expect(
        claimFxn({
          userAddress: 'bad',
          gaugeAddress: testGaugeAddress,
        })
      ).rejects.toThrow()
    })
  })

  describe('claimRewards', () => {
    it('returns gauge.claim tx', async () => {
      const result = await claimRewards({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(result.txs.length).toBe(1)
      const tx = result.txs[0]
      expect(tx.type).toBe('claimRewards')
      expect(tx.to).toBe(testGaugeAddress)
    }, 30000)

    it('uses receiver when provided', async () => {
      const receiver = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const result = await claimRewards({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
        receiver,
      })
      expect(result.txs.length).toBe(1)
    }, 30000)

    it('throws for invalid gauge address', async () => {
      await expect(
        claimRewards({
          userAddress: TEST_USER,
          gaugeAddress: 'bad',
        })
      ).rejects.toThrow()
    })
  })
})
