import { describe, it, expect } from 'vitest'
import { contracts } from '../src/configs/contracts'
import { tokens } from '../src/configs/tokens'

describe('Task 1: Lock & Earn Walking Skeleton', () => {
  describe('Contract addresses', () => {
    it('has veFXN address', () => {
      expect(contracts.veFXN).toBe('0xEC6B8A3F3605B083F7044C0F31f2cac0caf1d469')
    })

    it('has FeeDistributor address', () => {
      expect(contracts.FeeDistributor).toBe('0xd116513EEa4Efe3908212AfBAeFC76cb29245681')
    })

    it('has VotingEscrowBoost address', () => {
      expect(contracts.VotingEscrowBoost).toBe('0x8Cc02c0D9592976635E98e6446ef4976567E7A81')
    })

    it('has FXN_TokenMinter address', () => {
      expect(contracts.FXN_TokenMinter).toBe('0xC8b194925D55d5dE9555AD1db74c149329F71DeF')
    })

    it('has FXN_Token address', () => {
      expect(contracts.FXN_Token).toBe('0x365AccFCa291e7D3914637ABf1F7635dB165Bb09')
    })
  })

  describe('Token config', () => {
    it('has FXN token', () => {
      expect(tokens.FXN).toBe('0x365AccFCa291e7D3914637ABf1F7635dB165Bb09')
    })
  })

  describe('Lock types compile and export correctly', () => {
    it('Lock types are importable', async () => {
      const types = await import('../src/types/lock')
      expect(types).toBeDefined()
    })
  })

  describe('Earn types compile and export correctly', () => {
    it('Earn types are importable', async () => {
      const types = await import('../src/types/earn')
      expect(types).toBeDefined()
    })
  })

  describe('Types re-exported from index', () => {
    it('types/index re-exports lock and earn', async () => {
      const types = await import('../src/types/index')
      expect(types).toBeDefined()
    })
  })

  describe('ABIs exist and are valid', () => {
    it('VotingEscrow ABI has create_lock', async () => {
      const abi = (await import('../src/abis/VotingEscrow.json')).default
      const hasCreateLock = abi.some(
        (item: { name?: string }) => item.name === 'create_lock'
      )
      expect(hasCreateLock).toBe(true)
    })

    it('FeeDistributor ABI has claim', async () => {
      const abi = (await import('../src/abis/FeeDistributor.json')).default
      const hasClaim = abi.some(
        (item: { name?: string }) => item.name === 'claim'
      )
      expect(hasClaim).toBe(true)
    })

    it('VotingEscrowBoost ABI has boost', async () => {
      const abi = (await import('../src/abis/VotingEscrowBoost.json')).default
      const hasBoost = abi.some(
        (item: { name?: string }) => item.name === 'boost'
      )
      expect(hasBoost).toBe(true)
    })

    it('SharedLiquidityGauge ABI has deposit', async () => {
      const abi = (await import('../src/abis/SharedLiquidityGauge.json')).default
      const hasDeposit = abi.some(
        (item: { name?: string }) => item.name === 'deposit'
      )
      expect(hasDeposit).toBe(true)
    })

    it('FXNTokenMinter ABI has mint', async () => {
      const abi = (await import('../src/abis/FXNTokenMinter.json')).default
      const hasMint = abi.some(
        (item: { name?: string }) => item.name === 'mint'
      )
      expect(hasMint).toBe(true)
    })
  })
})
