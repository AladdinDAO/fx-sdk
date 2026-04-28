import { describe, it, expect } from 'vitest'
import { FxSdk } from '../src/core'
import { getClient } from '../src/core/client'

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

  it('should use the latest sdk chain for bare getClient() so base after mainnet is not stuck on mainnet', () => {
    const _mainnet = new FxSdk({
      chainId: 1,
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
    })
    expect(getClient().chain?.id).toBe(1)

    const _base = new FxSdk({
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
    })
    expect(getClient().chain?.id).toBe(8453)

    const _backToMainnet = new FxSdk({ chainId: 1 })
    expect(getClient().chain?.id).toBe(1)
  })
})

