import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { PoolName } from '../src/types/pool'
import { tokens } from '../src/configs/tokens'

describe('FxSDK', () => {
  it('getPosition should return position', async () => {
    const sdk = new FxSdk({
      userAddress: '0xa50E1946214D2Ef1Da33f2ba8686A2eA0f86C9C2',
    })
    const position = await sdk.increasePosition({
      poolName: PoolName.wstETH,
      positionId: 10,
      leverage: 3,
      fromAmount: 1000000000000000000n,
      fromTokenAddress: tokens.weth,
      slippage: 1,
    })

    // expect(position).toBeDefined();
  }, 100000)
})
