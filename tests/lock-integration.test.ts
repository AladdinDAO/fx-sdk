import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import type {
  GetLockInfoRequest,
  GetLockInfoResult,
  CreateLockRequest,
  CreateLockResult,
  IncreaseLockAmountRequest,
  IncreaseLockAmountResult,
  ExtendLockTimeRequest,
  ExtendLockTimeResult,
  WithdrawLockRequest,
  WithdrawLockResult,
  ClaimLockRewardsRequest,
  ClaimLockRewardsResult,
  DelegateBoostRequest,
  DelegateBoostResult,
  UndelegateBoostRequest,
  UndelegateBoostResult,
} from '../src/index'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const ONE_E18 = 10n ** 18n

describe('Lock Integration via FxSdk', () => {
  const sdk = new FxSdk()

  describe('FxSdk class has Lock methods', () => {
    it('has getLockInfo method', () => {
      expect(typeof sdk.getLockInfo).toBe('function')
    })

    it('has createLock method', () => {
      expect(typeof sdk.createLock).toBe('function')
    })

    it('has increaseLockAmount method', () => {
      expect(typeof sdk.increaseLockAmount).toBe('function')
    })

    it('has extendLockTime method', () => {
      expect(typeof sdk.extendLockTime).toBe('function')
    })

    it('has withdrawLock method', () => {
      expect(typeof sdk.withdrawLock).toBe('function')
    })

    it('has claimLockRewards method', () => {
      expect(typeof sdk.claimLockRewards).toBe('function')
    })

    it('has delegateBoost method', () => {
      expect(typeof sdk.delegateBoost).toBe('function')
    })

    it('has undelegateBoost method', () => {
      expect(typeof sdk.undelegateBoost).toBe('function')
    })
  })

  describe('getLockInfo via SDK', () => {
    it('returns correct structure with all fields', async () => {
      const result = await sdk.getLockInfo({ userAddress: TEST_USER })
      expect(result).toHaveProperty('lockedAmount')
      expect(result).toHaveProperty('lockEnd')
      expect(result).toHaveProperty('lockStatus')
      expect(result).toHaveProperty('vePower')
      expect(result).toHaveProperty('veTotalSupply')
      expect(result).toHaveProperty('pendingWstETH')
      expect(['no-lock', 'active', 'expired']).toContain(result.lockStatus)
    }, 60000)
  })

  describe('createLock via SDK', () => {
    it('returns valid tx array with lock tx', async () => {
      const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
      const result = await sdk.createLock({
        userAddress: TEST_USER,
        amount: ONE_E18,
        unlockTime: oneYear,
      })
      expect(result.txs.length).toBeGreaterThan(0)
      expect(result.txs.find((t) => t.type === 'lock')).toBeDefined()
    }, 60000)
  })

  describe('Lock types export from src/index.ts', () => {
    it('Lock request/result types are importable', () => {
      const req: GetLockInfoRequest = { userAddress: TEST_USER }
      expect(req.userAddress).toBe(TEST_USER)

      const createReq: CreateLockRequest = {
        userAddress: TEST_USER,
        amount: ONE_E18,
        unlockTime: 9999999999,
      }
      expect(createReq.amount).toBe(ONE_E18)
    })
  })
})
