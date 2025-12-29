import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { tokens } from '../src/configs/tokens'

describe('FxSDK - Edge Cases', () => {
  const sdk = new FxSdk()
  const validUserAddress = '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2'

  describe('New Position (positionId = 0)', () => {
    it(
      'should handle opening new position with minimal amount',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 15n, // 0.001 ETH
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result.positionId).toBe(0)
      },
      60000
    )

    it(
      'should handle opening new position with high leverage',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 10,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 5,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('Slippage Edge Cases', () => {
    it(
      'should handle very low slippage (0.1%)',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 0.1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )

    it(
      'should handle high slippage (5%)',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 5,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('Close Position', () => {
    it(
      'should handle closing position completely',
      async () => {
        const result = await sdk.reducePosition({
          market: 'ETH',
          type: 'long',
          positionId: 1,
          outputTokenAddress: tokens.wstETH,
          amount: 1n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
          isClosePosition: true,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('Different Token Addresses', () => {
    it(
      'should handle native ETH address',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.eth, // Native ETH
          amount: 1n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )

    it(
      'should handle WETH address',
      async () => {
        const result = await sdk.increasePosition({
          market: 'ETH',
          type: 'long',
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('Zero Amount Operations', () => {
    it(
      'should handle deposit with zero amount (only mint)',
      async () => {
        const result = await sdk.depositAndMint({
          market: 'ETH',
          positionId: 1,
          depositTokenAddress: tokens.stETH,
          depositAmount: 0n,
          mintAmount: 1000n * 10n ** 18n,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )

    it(
      'should handle repay with zero amount (only withdraw)',
      async () => {
        const result = await sdk.repayAndWithdraw({
          market: 'ETH',
          positionId: 1,
          repayAmount: 0n,
          withdrawAmount: 1n * 10n ** 18n,
          withdrawTokenAddress: tokens.stETH,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })
})

