import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'

describe('FxSdk - Initialization', () => {
  it('should initialize with default config', () => {
    const sdk = new FxSdk()
    expect(sdk).toBeDefined()
    expect(sdk).toBeInstanceOf(FxSdk)
  })

  it('should initialize with custom RPC URL', () => {
    const sdk = new FxSdk({
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
    })
    expect(sdk).toBeDefined()
  })

  it('should initialize with custom chain ID', () => {
    const sdk = new FxSdk({
      chainId: 1,
    })
    expect(sdk).toBeDefined()
  })

  it('should initialize with both RPC URL and chain ID', () => {
    const sdk = new FxSdk({
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
      chainId: 1,
    })
    expect(sdk).toBeDefined()
  })

  it('should allow multiple SDK instances', () => {
    const sdk1 = new FxSdk()
    const sdk2 = new FxSdk()
    expect(sdk1).toBeDefined()
    expect(sdk2).toBeDefined()
  })
})

