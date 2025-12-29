import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { PoolName } from '../src/types/pool'
import { tokens } from '../src/configs/tokens'

describe('FxSDK - All Pool Types', () => {
  const sdk = new FxSdk()
  const validUserAddress = '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2'

  describe('WBTC Pool', () => {
    it(
      'should increase position for WBTC long',
      async () => {
        const result = await sdk.increasePosition({
          poolName: PoolName.WBTC,
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.usdc,
          amount: 10000n * 10n ** 6n, // 10000 USDC
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result.routes).toBeDefined()
        expect(Array.isArray(result.routes)).toBe(true)
        expect(result.positionId).toBe(0)
      },
      60000
    )

    it(
      'should reduce position for WBTC long',
      async () => {
        const result = await sdk.reducePosition({
          poolName: PoolName.WBTC,
          positionId: 1,
          outputTokenAddress: tokens.usdc,
          amount: 1000n * 10n ** 6n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('WBTC Short Pool', () => {
    it(
      'should increase position for WBTC short',
      async () => {
        const result = await sdk.increasePosition({
          poolName: PoolName.WBTC_short,
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.usdc,
          amount: 10000n * 10n ** 6n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result.routes).toBeDefined()
      },
      60000
    )

    it(
      'should adjust leverage for WBTC short',
      async () => {
        const result = await sdk.adjustPositionLeverage({
          poolName: PoolName.WBTC_short,
          positionId: 1,
          leverage: 2,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
      },
      60000
    )
  })

  describe('wstETH Pool', () => {
    it(
      'should increase position for wstETH long with different tokens',
      async () => {
        // Test with WETH
        const result1 = await sdk.increasePosition({
          poolName: PoolName.wstETH,
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.weth,
          amount: 10n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
        })
        expect(result1).toBeDefined()

        // Test with USDC
        const result2 = await sdk.increasePosition({
          poolName: PoolName.wstETH,
          positionId: 0,
          leverage: 2,
          inputTokenAddress: tokens.usdc,
          amount: 20000n * 10n ** 6n,
          slippage: 1,
          userAddress: validUserAddress,
        })
        expect(result2).toBeDefined()
      },
      120000
    )
  })
})

