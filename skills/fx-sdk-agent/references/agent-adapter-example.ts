import { FxSdk, tokens } from '@aladdindao/fx-sdk'
import type { Address } from 'viem'

export type FxAction =
  | {
      kind: 'getPositions'
      userAddress: Address
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
    }
  | {
      kind: 'increasePosition'
      market: 'ETH' | 'BTC'
      type: 'long' | 'short'
      positionId: number
      leverage: number
      inputTokenAddress: Address
      amount: bigint
      slippage: number
      userAddress: Address
    }
  | {
      kind: 'getBridgeQuote'
      sourceChainId: 1 | 8453
      destChainId: 1 | 8453
      token: string
      amount: bigint
      recipient: Address
      sourceRpcUrl?: string
    }
  | {
      kind: 'buildBridgeTx'
      sourceChainId: 1 | 8453
      destChainId: 1 | 8453
      token: string
      amount: bigint
      recipient: Address
      refundAddress?: Address
      sourceRpcUrl?: string
    }

export interface AdapterOptions {
  rpcUrl?: string
  chainId?: number
  planOnly?: boolean
}

export async function runFxAction(action: FxAction, options: AdapterOptions = {}) {
  const chainId = options.chainId ?? 1
  const sdk = new FxSdk({ rpcUrl: options.rpcUrl, chainId })

  if (action.kind === 'getPositions') {
    return sdk.getPositions(action)
  }

  if (action.kind === 'increasePosition') {
    const result = await sdk.increasePosition(action)

    if (options.planOnly ?? true) {
      return {
        mode: 'plan',
        positionId: result.positionId,
        routes: result.routes,
      }
    }

    return {
      mode: 'execute_required',
      message: 'Use wallet client to send selected route.txs sequentially.',
      routePreview: result.routes[0],
    }
  }

  if (action.kind === 'getBridgeQuote') {
    const quote = await sdk.getBridgeQuote({
      sourceChainId: action.sourceChainId,
      destChainId: action.destChainId,
      token: action.token,
      amount: action.amount,
      recipient: action.recipient,
      sourceRpcUrl: action.sourceRpcUrl,
    })
    return { mode: 'plan', quote }
  }

  if (action.kind === 'buildBridgeTx') {
    const result = await sdk.buildBridgeTx({
      sourceChainId: action.sourceChainId,
      destChainId: action.destChainId,
      token: action.token,
      amount: action.amount,
      recipient: action.recipient,
      refundAddress: action.refundAddress,
      sourceRpcUrl: action.sourceRpcUrl,
    })

    if (options.planOnly ?? true) {
      return {
        mode: 'plan',
        tx: result.tx,
        quote: result.quote,
      }
    }

    return {
      mode: 'execute_required',
      message: 'Use wallet client to send result.tx (to, data, value) on source chain.',
      tx: result.tx,
      quote: result.quote,
    }
  }

  throw new Error('Unsupported action kind')
}

// Example payload for agent planners
export const sampleIncreasePayload: FxAction = {
  kind: 'increasePosition',
  market: 'ETH',
  type: 'short',
  positionId: 0,
  leverage: 3,
  inputTokenAddress: tokens.wstETH as Address,
  amount: 10n ** 17n,
  slippage: 1,
  userAddress: '0x0000000000000000000000000000000000000001',
}
