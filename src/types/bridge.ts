/** Request for getBridgeQuote (Base <-> Ethereum via LayerZero V2 OFT). */
export interface BridgeQuoteRequest {
  /** Source chain ID: 1 (Ethereum) or 8453 (Base). */
  sourceChainId: 1 | 8453
  /** Destination chain ID: 1 or 8453 (must differ from sourceChainId). */
  destChainId: 1 | 8453
  /** Token: pre-set key (e.g. 'ALT') or OFT contract address on source chain. */
  token: string
  /** Amount in wei (token's smallest unit on source chain). */
  amount: bigint
  /** Recipient address on destination chain. */
  recipient: string
  /** Optional: RPC URL for source chain (for quote read call). */
  sourceRpcUrl?: string
}

/** Result of getBridgeQuote. */
export interface BridgeQuoteResult {
  /** Native gas fee (wei) to pass as tx value when sending. */
  nativeFee: bigint
  /** LZ token fee (wei); 0 when paying in native. */
  lzTokenFee: bigint
}

/** Request for buildBridgeTx. */
export interface BuildBridgeTxRequest extends BridgeQuoteRequest {
  /** Refund address for excess fee; defaults to sender. */
  refundAddress?: string
}

/** Single tx payload compatible with existing example send loop (to, data, value). */
export interface BridgeTxPayload {
  to: string
  data: `0x${string}`
  value: bigint
}

/** Result of buildBridgeTx. */
export interface BuildBridgeTxResult {
  /** One tx to execute on source chain. */
  tx: BridgeTxPayload
  /** Quote used for this tx (nativeFee = tx.value). */
  quote: BridgeQuoteResult
}
