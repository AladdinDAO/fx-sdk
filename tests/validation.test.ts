import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { tokens } from '../src/configs/tokens'

describe('FxSDK - Input Validation', () => {
  const sdk = new FxSdk()
  const validUserAddress = '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2'

  describe('increasePosition', () => {
    it('should throw error for invalid amount (0)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 0n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('From amount must be greater than 0')
    })

    it('should throw error for invalid amount (negative)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: -100n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('From amount must be greater than 0')
    })

    it('should throw error for invalid token address', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: 'invalid-address',
          amount: 100000000000000000000n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('From token address is not a valid address')
    })

    it('should throw error for invalid slippage (0)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 100000000000000000000n,
          slippage: 0,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Slippage must be between 0 and 100')
    })

    it('should throw error for invalid slippage (100)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 100000000000000000000n,
          slippage: 100,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Slippage must be between 0 and 100')
    })

    it('should throw error for invalid leverage (0)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 0,
          inputTokenAddress: tokens.weth,
          amount: 100000000000000000000n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Leverage must be greater than 0')
    })

    it('should throw error for invalid position ID (negative)', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: -1,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 100000000000000000000n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Position ID must be a positive number')
    })

    it('should throw error for invalid user address', async () => {
      await expect(
        sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 100000000000000000000n,
          slippage: 1,
          userAddress: 'invalid-address',
        })
      ).rejects.toThrow('User address is not a valid address')
    })
  })

  describe('reducePosition', () => {
    it('should throw error for invalid amount (0)', async () => {
      await expect(
        sdk.reducePosition({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          outputTokenAddress: tokens.wstETH,
          amount: 0n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('From amount must be greater than 0')
    })

    it('should throw error for invalid token address', async () => {
      await expect(
        sdk.reducePosition({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          outputTokenAddress: 'invalid-address',
          amount: 100000000000000000000n,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('From token address is not a valid address')
    })

    it('should throw error for invalid slippage', async () => {
      await expect(
        sdk.reducePosition({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          outputTokenAddress: tokens.wstETH,
          amount: 100000000000000000000n,
          slippage: 150,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Slippage must be between 0 and 100')
    })
  })

  describe('adjustPositionLeverage', () => {
    it('should throw error for invalid leverage (0)', async () => {
      await expect(
        sdk.adjustPositionLeverage({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          leverage: 0,
          slippage: 1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Leverage must be greater than 0')
    })

    it('should throw error for invalid slippage', async () => {
      await expect(
        sdk.adjustPositionLeverage({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          leverage: 3,
          slippage: -1,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Slippage must be between 0 and 100')
    })
  })

  describe('depositAndMint', () => {
    it('should throw error for negative deposit amount', async () => {
      await expect(
        sdk.depositAndMint({
          market: 'ETH',
          positionId: 1,
          depositTokenAddress: tokens.stETH,
          depositAmount: -1n,
          mintAmount: 1000n * 10n ** 18n,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Deposit amount must be greater than or equal to 0')
    })

    it('should throw error for negative mint amount', async () => {
      await expect(
        sdk.depositAndMint({
          market: 'ETH',
          positionId: 1,
          depositTokenAddress: tokens.stETH,
          depositAmount: 1n * 10n ** 18n,
          mintAmount: -1n,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Mint amount must be greater than or equal to 0')
    })

    it('should throw error for invalid deposit token address', async () => {
      await expect(
        sdk.depositAndMint({
          market: 'ETH',
          positionId: 1,
          depositTokenAddress: 'invalid-address',
          depositAmount: 1n * 10n ** 18n,
          mintAmount: 1000n * 10n ** 18n,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Deposit token address is not a valid address')
    })
  })

  describe('repayAndWithdraw', () => {
    it('should throw error for negative repay amount', async () => {
      await expect(
        sdk.repayAndWithdraw({
          market: 'ETH',
          positionId: 1,
          repayAmount: -1n,
          withdrawAmount: 1n * 10n ** 18n,
          withdrawTokenAddress: tokens.stETH,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Repay amount must be greater than or equal to 0')
    })

    it('should throw error for negative withdraw amount', async () => {
      await expect(
        sdk.repayAndWithdraw({
          market: 'ETH',
          positionId: 1,
          repayAmount: 1000n * 10n ** 18n,
          withdrawAmount: -1n,
          withdrawTokenAddress: tokens.stETH,
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Withdraw amount must be greater than or equal to 0')
    })

    it('should throw error for invalid withdraw token address', async () => {
      await expect(
        sdk.repayAndWithdraw({
          market: 'ETH',
          positionId: 1,
          repayAmount: 1000n * 10n ** 18n,
          withdrawAmount: 1n * 10n ** 18n,
          withdrawTokenAddress: 'invalid-address',
          userAddress: validUserAddress,
        })
      ).rejects.toThrow('Withdraw token address is not a valid address')
    })
  })
})

