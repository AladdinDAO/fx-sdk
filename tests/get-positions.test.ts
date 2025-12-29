import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'

describe('FxSDK - Get Positions', () => {
  const sdk = new FxSdk()
  const validUserAddress = '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2'

  describe('getPositions', () => {
    it(
      'should return empty array when user has no positions',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: '0x0000000000000000000000000000000000000000',
          market: 'ETH',
          type: 'long',
        })

        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)
        expect(positions.length).toBe(0)
      },
      60000
    )

    it(
      'should return positions for ETH long market',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: validUserAddress,
          market: 'ETH',
          type: 'long',
        })

        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)

        if (positions.length > 0) {
          const position = positions[0]
          expect(position).toHaveProperty('rawColls')
          expect(position).toHaveProperty('rawDebts')
          expect(position).toHaveProperty('currentLeverage')
          expect(position).toHaveProperty('lsdLeverage')
          expect(typeof position.rawColls).toBe('bigint')
          expect(typeof position.rawDebts).toBe('bigint')
          expect(typeof position.currentLeverage).toBe('number')
          expect(typeof position.lsdLeverage).toBe('number')
        }
      },
      60000
    )

    it(
      'should return positions for ETH short market',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: validUserAddress,
          market: 'ETH',
          type: 'short',
        })

        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)

        if (positions.length > 0) {
          const position = positions[0]
          expect(position).toHaveProperty('rawColls')
          expect(position).toHaveProperty('rawDebts')
          expect(position).toHaveProperty('currentLeverage')
          expect(position).toHaveProperty('lsdLeverage')
        }
      },
      60000
    )

    it(
      'should return positions for BTC long market',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: validUserAddress,
          market: 'BTC',
          type: 'long',
        })

        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)

        if (positions.length > 0) {
          const position = positions[0]
          expect(position).toHaveProperty('rawColls')
          expect(position).toHaveProperty('rawDebts')
          expect(position).toHaveProperty('currentLeverage')
          expect(position).toHaveProperty('lsdLeverage')
        }
      },
      60000
    )

    it(
      'should return positions for BTC short market',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: validUserAddress,
          market: 'BTC',
          type: 'short',
        })

        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)

        if (positions.length > 0) {
          const position = positions[0]
          expect(position).toHaveProperty('rawColls')
          expect(position).toHaveProperty('rawDebts')
          expect(position).toHaveProperty('currentLeverage')
          expect(position).toHaveProperty('lsdLeverage')
        }
      },
      60000
    )

    it(
      'should handle invalid user address gracefully',
      async () => {
        const positions = await sdk.getPositions({
          userAddress: 'invalid-address',
          market: 'ETH',
          type: 'long',
        })

        // Should return empty array or throw error
        expect(positions).toBeDefined()
        expect(Array.isArray(positions)).toBe(true)
      },
      60000
    )
  })
})

