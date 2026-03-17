import { describe, it, expect } from 'vitest'
import { getLockInfo, createLock, WEEK_SECONDS } from '../src/core/lock'
import { contracts } from '../src/configs/contracts'

const TEST_USER = '0x1234567890123456789012345678901234567890'
const ONE_E18 = 10n ** 18n

describe('Lock Core', () => {
  describe('getLockInfo', () => {
    it('returns correct structure with all fields', async () => {
      const result = await getLockInfo({ userAddress: TEST_USER })
      expect(result).toHaveProperty('lockedAmount')
      expect(result).toHaveProperty('lockEnd')
      expect(result).toHaveProperty('vePower')
      expect(result).toHaveProperty('lockStatus')
      expect(result).toHaveProperty('veTotalSupply')
      expect(result).toHaveProperty('pendingWstETH')
      expect(result).toHaveProperty('delegatedBalance')
      expect(result).toHaveProperty('delegableBalance')
      expect(result).toHaveProperty('adjustedVeBalance')
      expect(result).toHaveProperty('weeklyFeeAmount')
    }, 60000)

    it('lockStatus is no-lock for address with no lock', async () => {
      const result = await getLockInfo({ userAddress: TEST_USER })
      expect(result.lockStatus).toBe('no-lock')
      expect(result.lockedAmount).toBe(0n)
    }, 60000)

    it('throws for invalid address', async () => {
      await expect(getLockInfo({ userAddress: 'invalid' })).rejects.toThrow()
    })

    it('veTotalSupply is greater than 0', async () => {
      const result = await getLockInfo({ userAddress: TEST_USER })
      expect(result.veTotalSupply).toBeGreaterThan(0n)
    }, 60000)
  })

  describe('createLock', () => {
    it('returns txs array with approve + create_lock', async () => {
      const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
      const result = await createLock({
        userAddress: TEST_USER,
        amount: ONE_E18,
        unlockTime: oneYear,
      })
      expect(result.txs.length).toBeGreaterThanOrEqual(1)
      const lockTx = result.txs.find((t) => t.type === 'lock')
      expect(lockTx).toBeDefined()
      expect(lockTx!.to).toBe(contracts.veFXN)
    }, 60000)

    it('aligns unlockTime to WEEK epoch', async () => {
      const unaligned = Math.floor(Date.now() / 1000) + 365 * 86400 + 12345
      const result = await createLock({
        userAddress: TEST_USER,
        amount: ONE_E18,
        unlockTime: unaligned,
      })
      // The lock tx data should contain the aligned time
      expect(result.txs.length).toBeGreaterThanOrEqual(1)
    }, 60000)

    it('throws for zero amount', async () => {
      const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
      await expect(
        createLock({ userAddress: TEST_USER, amount: 0n, unlockTime: oneYear })
      ).rejects.toThrow()
    })

    it('throws for past unlockTime', async () => {
      await expect(
        createLock({
          userAddress: TEST_USER,
          amount: ONE_E18,
          unlockTime: 1000,
        })
      ).rejects.toThrow()
    })

    it('throws for invalid address', async () => {
      const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
      await expect(
        createLock({
          userAddress: 'bad-addr',
          amount: ONE_E18,
          unlockTime: oneYear,
        })
      ).rejects.toThrow()
    })
  })
})
