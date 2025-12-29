import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { PoolName } from '../src/types/pool'
import { tokens } from '../src/configs/tokens'

describe('FxSDK - Transaction Structure', () => {
  const sdk = new FxSdk()
  const validUserAddress = '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2'

  describe('increasePosition transaction structure', () => {
    it(
      'should return correct transaction structure',
      async () => {
        const result = await sdk.increasePosition({
          poolName: PoolName.wstETH,
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('positionId')
        expect(result).toHaveProperty('slippage')
        expect(result).toHaveProperty('routes')
        expect(Array.isArray(result.routes)).toBe(true)

        if (result.routes.length > 0) {
          const route = result.routes[0]
          expect(route).toHaveProperty('routeType')
          expect(route).toHaveProperty('positionId')
          expect(route).toHaveProperty('newLeverage')
          expect(route).toHaveProperty('slippage')
          expect(route).toHaveProperty('priceImpact')
          expect(route).toHaveProperty('txs')
          expect(Array.isArray(route.txs)).toBe(true)

          // Check transaction structure
          route.txs.forEach((tx: any, index: number) => {
            expect(tx).toHaveProperty('type')
            expect(tx).toHaveProperty('from')
            expect(tx).toHaveProperty('to')
            expect(tx).toHaveProperty('data')
            expect(tx).toHaveProperty('nonce')
            expect(typeof tx.nonce).toBe('number')
            expect(tx.nonce).toBeGreaterThanOrEqual(0)
          })

          // Verify nonce ordering
          for (let i = 1; i < route.txs.length; i++) {
            expect(route.txs[i].nonce).toBeGreaterThan(route.txs[i - 1].nonce)
          }
        }
      },
      60000
    )

    it(
      'should include approve transactions when needed',
      async () => {
        const result = await sdk.increasePosition({
          poolName: PoolName.wstETH,
          positionId: 0,
          leverage: 3,
          inputTokenAddress: tokens.weth,
          amount: 1n * 10n ** 18n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        if (result.routes.length > 0 && result.routes[0].txs.length > 0) {
          const txTypes = result.routes[0].txs.map((tx: any) => tx.type)
          // Should have at least a trade transaction
          expect(txTypes).toContain('trade')
          // May have approveToken or approvePosition
        }
      },
      60000
    )
  })

  describe('reducePosition transaction structure', () => {
    it(
      'should return correct transaction structure',
      async () => {
        const result = await sdk.reducePosition({
          poolName: PoolName.wstETH,
          positionId: 1,
          outputTokenAddress: tokens.wstETH,
          amount: 1n * 10n ** 17n,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('positionId')
        expect(result).toHaveProperty('routes')
        expect(Array.isArray(result.routes)).toBe(true)
      },
      60000
    )
  })

  describe('adjustPositionLeverage transaction structure', () => {
    it(
      'should return correct transaction structure',
      async () => {
        const result = await sdk.adjustPositionLeverage({
          poolName: PoolName.wstETH,
          positionId: 1,
          leverage: 3,
          slippage: 1,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('positionId')
        expect(result).toHaveProperty('routes')
      },
      60000
    )
  })

  describe('depositAndMint transaction structure', () => {
    it(
      'should return correct transaction structure',
      async () => {
        const result = await sdk.depositAndMint({
          poolName: PoolName.wstETH,
          positionId: 1,
          depositTokenAddress: tokens.stETH,
          depositAmount: 1n * 10n ** 18n,
          mintAmount: 1000n * 10n ** 18n,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('txs')
        expect(Array.isArray(result.txs)).toBe(true)
      },
      60000
    )
  })

  describe('repayAndWithdraw transaction structure', () => {
    it(
      'should return correct transaction structure',
      async () => {
        const result = await sdk.repayAndWithdraw({
          poolName: PoolName.wstETH,
          positionId: 1,
          repayAmount: 1000n * 10n ** 18n,
          withdrawAmount: 1n * 10n ** 18n,
          withdrawTokenAddress: tokens.stETH,
          userAddress: validUserAddress,
        })

        expect(result).toBeDefined()
        expect(result).toHaveProperty('txs')
        expect(Array.isArray(result.txs)).toBe(true)
      },
      60000
    )
  })
})

