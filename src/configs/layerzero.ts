/**
 * LayerZero V2 config for Base <-> Ethereum bridge.
 * Endpoint: same address on both chains.
 * EIDs: https://docs.layerzero.network/v2/deployments/deployed-contracts
 */
export const LZ_ENDPOINT_ADDRESS =
  '0x1a44076050125825900e736c501f859c50fE728c' as const

export const EID_ETHEREUM = 30101
export const EID_BASE = 30184

export const CHAIN_ID_ETHEREUM = 1
export const CHAIN_ID_BASE = 8453

export const SUPPORTED_BRIDGE_CHAIN_IDS = [CHAIN_ID_ETHEREUM, CHAIN_ID_BASE] as const
export type SupportedBridgeChainId = (typeof SUPPORTED_BRIDGE_CHAIN_IDS)[number]

export function getEidByChainId(chainId: number): number {
  if (chainId === CHAIN_ID_ETHEREUM) return EID_ETHEREUM
  if (chainId === CHAIN_ID_BASE) return EID_BASE
  throw new Error(`Unsupported bridge chainId: ${chainId}. Use 1 (Ethereum) or 8453 (Base).`)
}

/** Default RPC URLs for read-only calls (quote). Override via request when needed. */
export const DEFAULT_RPC_BY_CHAIN: Record<number, string> = {
  [CHAIN_ID_ETHEREUM]: 'https://ethereum-rpc.publicnode.com',
  [CHAIN_ID_BASE]: 'https://mainnet.base.org',
}

/**
 * Supported OFT tokens for Base <-> Ethereum bridge.
 * tokenId -> { [chainId]: contract to call quoteSend/send on }
 * - Ethereum: RootEndPointV2 (user approves this to spend rootToken)
 * - Base: childToken (OFT)
 * Addresses from layerzero-bridge/config/network/base.js and ethermum.js.
 */
export type BridgeTokenId = 'fxUSD' | 'fxSAVE'

export const BRIDGE_OFT_BY_TOKEN: Record<
  BridgeTokenId,
  { [CHAIN_ID_ETHEREUM]: string; [CHAIN_ID_BASE]: string }
> = {
  fxUSD: {
    [CHAIN_ID_ETHEREUM]: '0xA07d8cc424421cC2bce0544a65481376f010A438', // rootEndPointV2
    [CHAIN_ID_BASE]: '0x55380fe7a1910dff29a47b622057ab4139da42c5', // childToken
  },
  fxSAVE: {
    [CHAIN_ID_ETHEREUM]: '0xCaD2b9C980322f460db51CC8E45539F677C73F86', // rootEndPointV2
    [CHAIN_ID_BASE]: '0x273f20fa9fbe803e5d6959add9582dac240ec3be', // childToken
  },
}

/**
 * LayerZero extraOptions per token (from layerzero-bridge/config/network/base.js).
 * Required by quoteSend/send for these OFTs to succeed.
 */
export const BRIDGE_EXTRA_OPTIONS_BY_TOKEN: Record<BridgeTokenId, `0x${string}`> = {
  fxUSD: '0x0003' as `0x${string}`,
  fxSAVE:
    '0x000301001101000000000000000000000000000249f0' as `0x${string}`,
}
