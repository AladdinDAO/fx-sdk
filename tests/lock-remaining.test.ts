import { describe, it, expect } from 'vitest'
import {
  increaseLockAmount,
  extendLockTime,
  withdrawLock,
  claimLockRewards,
  delegateBoost,
  undelegateBoost,
  WEEK_SECONDS,
} from '../src/core/lock'
import { contracts } from '../src/configs/contracts'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const RECEIVER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const ONE_E18 = 10n ** 18n

describe('Lock Remaining Methods', () => {
  describe('increaseLockAmount', () => {
    it('returns approve + increase_amount txs', async () => {
      const result = await increaseLockAmount({
        userAddress: TEST_USER,
        amount: ONE_E18,
      })
      expect(result.txs.length).toBeGreaterThanOrEqual(1)
      const lockTx = result.txs.find((t) => t.type === 'lock')
      expect(lockTx).toBeDefined()
      expect(lockTx!.to).toBe(contracts.veFXN)
    }, 60000)

    it('throws for zero amount', async () => {
      await expect(
        increaseLockAmount({ userAddress: TEST_USER, amount: 0n })
      ).rejects.toThrow()
    })

    it('throws for invalid address', async () => {
      await expect(
        increaseLockAmount({ userAddress: 'bad', amount: ONE_E18 })
      ).rejects.toThrow()
    })
  })

  describe('extendLockTime', () => {
    it('returns increase_unlock_time tx (no approve), time aligned', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 365 * 86400 + 12345
      const result = await extendLockTime({
        userAddress: TEST_USER,
        unlockTime: futureTime,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('lock')
      expect(result.txs[0].to).toBe(contracts.veFXN)
    }, 60000)

    it('throws for past unlockTime', async () => {
      await expect(
        extendLockTime({ userAddress: TEST_USER, unlockTime: 1000 })
      ).rejects.toThrow()
    })
  })

  describe('withdrawLock', () => {
    it('returns withdraw tx (no approve)', async () => {
      const result = await withdrawLock({ userAddress: TEST_USER })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('withdraw')
      expect(result.txs[0].to).toBe(contracts.veFXN)
    }, 60000)

    it('throws for invalid address', async () => {
      await expect(withdrawLock({ userAddress: 'bad' })).rejects.toThrow()
    })
  })

  describe('claimLockRewards', () => {
    it('returns FeeDistributor.claim tx', async () => {
      const result = await claimLockRewards({ userAddress: TEST_USER })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('claim')
      expect(result.txs[0].to).toBe(contracts.FeeDistributor)
    }, 60000)

    it('throws for invalid address', async () => {
      await expect(
        claimLockRewards({ userAddress: 'bad' })
      ).rejects.toThrow()
    })
  })

  describe('delegateBoost', () => {
    it('returns boost tx with aligned endTime', async () => {
      const endTime = Math.floor(Date.now() / 1000) + 30 * 86400 + 999
      const result = await delegateBoost({
        userAddress: TEST_USER,
        receiver: RECEIVER,
        amount: ONE_E18,
        endTime,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('boost')
      expect(result.txs[0].to).toBe(contracts.VotingEscrowBoost)
    }, 60000)

    it('throws for invalid user address', async () => {
      await expect(
        delegateBoost({
          userAddress: 'bad',
          receiver: RECEIVER,
          amount: ONE_E18,
          endTime: Math.floor(Date.now() / 1000) + 30 * 86400,
        })
      ).rejects.toThrow()
    })

    it('throws for invalid receiver address', async () => {
      await expect(
        delegateBoost({
          userAddress: TEST_USER,
          receiver: 'bad',
          amount: ONE_E18,
          endTime: Math.floor(Date.now() / 1000) + 30 * 86400,
        })
      ).rejects.toThrow()
    })
  })

  describe('undelegateBoost', () => {
    it('returns unboost tx', async () => {
      const result = await undelegateBoost({
        userAddress: TEST_USER,
        boostIndex: 0,
        initialAmount: ONE_E18,
      })
      expect(result.txs.length).toBe(1)
      expect(result.txs[0].type).toBe('unboost')
      expect(result.txs[0].to).toBe(contracts.VotingEscrowBoost)
    }, 60000)

    it('throws for invalid address', async () => {
      await expect(
        undelegateBoost({
          userAddress: 'bad',
          boostIndex: 0,
          initialAmount: ONE_E18,
        })
      ).rejects.toThrow()
    })
  })
})
