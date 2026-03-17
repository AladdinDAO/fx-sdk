import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { contracts } from '../src/configs/contracts'
import type {
  GaugeInfo,
  GetGaugeListResult,
  GetEarnPositionRequest,
  GetEarnPositionResult,
  EarnDepositRequest,
  EarnDepositResult,
  EarnWithdrawRequest,
  EarnWithdrawResult,
  ClaimFxnRequest,
  ClaimFxnResult,
  ClaimRewardsRequest,
  ClaimRewardsResult,
} from '../src/index'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const ONE_E18 = 10n ** 18n

describe('Earn Integration via FxSdk', () => {
  const sdk = new FxSdk()
  let testGaugeAddress: string
  let testLpAddress: string

  beforeAll(async () => {
    const result = await sdk.getGaugeList()
    testGaugeAddress = result.gauges[0].gauge
    testLpAddress = result.gauges[0].lpAddress
  }, 30000)

  describe('FxSdk class has Earn methods', () => {
    it('has getGaugeList method', () => {
      expect(typeof sdk.getGaugeList).toBe('function')
    })

    it('has getEarnPosition method', () => {
      expect(typeof sdk.getEarnPosition).toBe('function')
    })

    it('has earnDeposit method', () => {
      expect(typeof sdk.earnDeposit).toBe('function')
    })

    it('has earnWithdraw method', () => {
      expect(typeof sdk.earnWithdraw).toBe('function')
    })

    it('has claimFxn method', () => {
      expect(typeof sdk.claimFxn).toBe('function')
    })

    it('has claimRewards method', () => {
      expect(typeof sdk.claimRewards).toBe('function')
    })
  })

  describe('getGaugeList via SDK', () => {
    it('returns Liquidity Gauges with correct structure', async () => {
      const result = await sdk.getGaugeList()
      expect(result.gauges.length).toBeGreaterThan(0)
      expect(result.gauges[0]).toHaveProperty('name')
      expect(result.gauges[0]).toHaveProperty('gauge')
      expect(result.gauges[0]).toHaveProperty('lpAddress')
    }, 30000)
  })

  describe('getEarnPosition via SDK', () => {
    it('returns stakedBalance and pendingFxn', async () => {
      const result = await sdk.getEarnPosition({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(typeof result.stakedBalance).toBe('bigint')
      expect(typeof result.pendingFxn).toBe('bigint')
      expect(result).toHaveProperty('pendingRewards')
    }, 30000)
  })

  describe('earnDeposit via SDK', () => {
    it('returns valid tx array', async () => {
      const result = await sdk.earnDeposit({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
        lpTokenAddress: testLpAddress,
        amount: ONE_E18,
      })
      expect(result.txs.length).toBeGreaterThanOrEqual(1)
      const depositTx = result.txs.find((t) => t.type === 'deposit')
      expect(depositTx).toBeDefined()
      expect(depositTx!.to).toBe(testGaugeAddress)
    }, 60000)
  })

  describe('earnWithdraw via SDK', () => {
    it('returns withdraw tx', async () => {
      const result = await sdk.earnWithdraw({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
        amount: ONE_E18,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('withdraw')
      expect(result.txs[0].to).toBe(testGaugeAddress)
    }, 30000)
  })

  describe('claimFxn via SDK', () => {
    it('returns FXNTokenMinter.mint tx', async () => {
      const result = await sdk.claimFxn({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('claimFxn')
      expect(result.txs[0].to).toBe(contracts.FXN_TokenMinter)
    }, 30000)
  })

  describe('claimRewards via SDK', () => {
    it('returns gauge.claim tx', async () => {
      const result = await sdk.claimRewards({
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('claimRewards')
      expect(result.txs[0].to).toBe(testGaugeAddress)
    }, 30000)
  })

  describe('Earn types export from src/index.ts', () => {
    it('Earn request/result types are importable', () => {
      const req: GetEarnPositionRequest = {
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
      }
      expect(req.userAddress).toBe(TEST_USER)

      const depositReq: EarnDepositRequest = {
        userAddress: TEST_USER,
        gaugeAddress: testGaugeAddress,
        lpTokenAddress: testLpAddress,
        amount: ONE_E18,
      }
      expect(depositReq.amount).toBe(ONE_E18)
    })
  })
})
