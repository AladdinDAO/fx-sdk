import { Chain, createPublicClient, http, type PublicClient } from 'viem'
import { base, mainnet } from 'viem/chains'
import { RPC_URL, CHAIN_ID } from '@/configs'
import { DEFAULT_RPC_BY_CHAIN } from '@/configs/layerzero'

/** Multicall3 on unknown chains (same canonical deployment as Ethereum). */
const DEFAULT_MULTICALL3 = {
  address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const,
  blockCreated: 14353601,
} as const

function buildChain(chainId: number, rpcUrl: string): Chain {
  const rpc = { default: { http: [rpcUrl] } }
  if (chainId === mainnet.id) {
    return { ...mainnet, rpcUrls: rpc }
  }
  if (chainId === base.id) {
    return { ...base, rpcUrls: rpc }
  }
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: rpc,
    contracts: { multicall3: DEFAULT_MULTICALL3 },
  }
}

export class RpcClient {
  private static instance: RpcClient
  /** Most recent explicit config (from FxSdk constructor or getClient(chainId?, rpcUrl?)). */
  private activeChainId = CHAIN_ID
  private activeRpcUrl = RPC_URL
  private clients = new Map<string, PublicClient>()

  private constructor() {}

  static getInstance(): RpcClient {
    if (!RpcClient.instance) {
      RpcClient.instance = new RpcClient()
    }
    return RpcClient.instance
  }

  private cacheKey(chainId: number, rpcUrl: string) {
    return `${chainId}:${rpcUrl}`
  }

  /**
   * Gets or creates a cached PublicClient for the active (or requested) chain and RPC.
   * The last FxSdk(config) or getClient(chainId, rpcUrl) sets which client bare getClient() uses.
   */
  getClient(chainId?: number, rpcUrl?: string): PublicClient {
    if (chainId !== undefined) {
      this.activeChainId = chainId
    }
    if (rpcUrl !== undefined) {
      this.activeRpcUrl = rpcUrl
    } else if (chainId !== undefined) {
      this.activeRpcUrl = DEFAULT_RPC_BY_CHAIN[chainId] ?? RPC_URL
    }

    const key = this.cacheKey(this.activeChainId, this.activeRpcUrl)
    let client = this.clients.get(key)
    if (client) {
      return client
    }

    const chain = buildChain(this.activeChainId, this.activeRpcUrl)
    client = createPublicClient({
      chain,
      batch: { multicall: true },
      transport: http(),
    })
    this.clients.set(key, client)
    return client
  }

  /**
   * Gets the RPC client instance (singleton).
   * @param chainId - Chain ID (defaults to configured value)
   * @param rpcUrl - RPC URL (defaults to configured value)
   * @returns viem PublicClient instance
   */
  static getClient(chainId?: number, rpcUrl?: string): PublicClient {
    return RpcClient.getInstance().getClient(chainId, rpcUrl)
  }
}

/**
 * Gets the RPC client instance (singleton).
 * @param chainId - Chain ID (defaults to configured value)
 * @param rpcUrl - RPC URL (defaults to configured value)
 * @returns viem PublicClient instance
 */
export function getClient(chainId?: number, rpcUrl?: string): PublicClient {
  return RpcClient.getClient(chainId, rpcUrl)
}
