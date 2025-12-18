import { PublicClient, createPublicClient, http } from 'viem'
import { RPC_URL, CHAIN_ID } from '@/configs'

export class RpcClient {
  private static instance: RpcClient
  private cachedClients: Record<string, PublicClient> = {}

  private constructor() {}

  static getInstance(): RpcClient {
    if (!RpcClient.instance) {
      RpcClient.instance = new RpcClient()
    }
    return RpcClient.instance
  }

  getClient(chainId?: number, rpcUrl?: string): PublicClient {
    const key = `${chainId ?? CHAIN_ID}-${rpcUrl ?? RPC_URL}`

    if (this.cachedClients[key]) {
      return this.cachedClients[key]
    }

    const client = createPublicClient({
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

    this.cachedClients[key] = client

    return client
  }

  static getClient(chainId?: number, rpcUrl?: string): PublicClient {
    return RpcClient.getInstance().getClient(chainId, rpcUrl)
  }
}

export function getClient(chainId?: number, rpcUrl?: string): PublicClient {
  return RpcClient.getClient(chainId, rpcUrl)
}
