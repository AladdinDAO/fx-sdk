import { PublicClient, createPublicClient, http } from 'viem'
import { RPC_URL, CHAIN_ID } from '@/configs'

export class RpcClient {
  private static instance: RpcClient
  private client: PublicClient | null = null

  private constructor() {}

  static getInstance(): RpcClient {
    if (!RpcClient.instance) {
      RpcClient.instance = new RpcClient()
    }
    return RpcClient.instance
  }

  /**
   * Gets or creates the RPC client instance (singleton).
   * @param chainId - Chain ID (defaults to configured value)
   * @param rpcUrl - RPC URL (defaults to configured value)
   * @returns viem PublicClient instance
   */
  getClient(chainId?: number, rpcUrl?: string): PublicClient {
    if (this.client) {
      return this.client
    }

    this.client = createPublicClient({
      batch: {
        multicall: true,
      },
      chain: {
        id: chainId ?? CHAIN_ID,
        name: 'Ethereum',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: {
          default: { http: [rpcUrl ?? RPC_URL] },
        },
        contracts: {
          multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 14353601,
          },
        },
      },
      transport: http(),
    })

    return this.client
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
