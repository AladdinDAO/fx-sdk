import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { isAddress } from 'viem'
import {
  getEidByChainId,
  DEFAULT_RPC_BY_CHAIN,
  BRIDGE_OFT_BY_TOKEN,
  BRIDGE_EXTRA_OPTIONS_BY_TOKEN,
  type BridgeTokenId,
  type SupportedBridgeChainId,
} from '@/configs/layerzero'
import type {
  BridgeQuoteRequest,
  BridgeQuoteResult,
  BuildBridgeTxRequest,
  BuildBridgeTxResult,
} from '@/types/bridge'

const SUPPORTED_CHAIN_IDS: readonly number[] = [1, 8453]

function assertSupportedChains(sourceChainId: number, destChainId: number): void {
  if (!SUPPORTED_CHAIN_IDS.includes(sourceChainId)) {
    throw new Error(
      `Unsupported sourceChainId: ${sourceChainId}. Use 1 (Ethereum) or 8453 (Base).`
    )
  }
  if (!SUPPORTED_CHAIN_IDS.includes(destChainId)) {
    throw new Error(
      `Unsupported destChainId: ${destChainId}. Use 1 (Ethereum) or 8453 (Base).`
    )
  }
  if (sourceChainId === destChainId) {
    throw new Error('sourceChainId and destChainId must differ.')
  }
}

function resolveOftAddress(
  sourceChainId: number,
  token: string
): { address: Address; isPreSet: boolean; tokenKey?: BridgeTokenId } {
  const chainId = sourceChainId as SupportedBridgeChainId
  const key = (Object.keys(BRIDGE_OFT_BY_TOKEN) as BridgeTokenId[]).find(
    (k) => k.toUpperCase() === token.toUpperCase()
  )
  if (key) {
    const oft = BRIDGE_OFT_BY_TOKEN[key][chainId]
    return { address: oft as Address, isPreSet: true, tokenKey: key }
  }
  if (isAddress(token)) {
    return { address: token as Address, isPreSet: false }
  }
  throw new Error(
    `Unsupported bridge token: "${token}". Use a pre-set token key (e.g. "fxUSD", "fxSAVE") or a valid OFT contract address.`
  )
}

function getExtraOptions(tokenKey?: BridgeTokenId): `0x${string}` {
  if (tokenKey && tokenKey in BRIDGE_EXTRA_OPTIONS_BY_TOKEN) {
    return BRIDGE_EXTRA_OPTIONS_BY_TOKEN[tokenKey]
  }
  return '0x' as `0x${string}`
}

/** Minimal OFT ABI for quoteSend and send (LayerZero V2). */
const OFT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
        name: '_sendParam',
        type: 'tuple',
      },
      { name: '_payInLzToken', type: 'bool' },
    ],
    name: 'quoteSend',
    outputs: [
      {
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
        name: 'fee',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
        name: '_sendParam',
        type: 'tuple',
      },
      {
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
        name: '_fee',
        type: 'tuple',
      },
      { name: '_refundAddress', type: 'address' },
    ],
    name: 'send',
    outputs: [
      {
        components: [
          { name: 'guid', type: 'bytes32' },
          { name: 'nonce', type: 'uint64' },
          { name: 'fee', type: 'tuple' },
        ],
        name: 'msgReceipt',
        type: 'tuple',
      },
      {
        components: [
          { name: 'amountDebitLD', type: 'uint256' },
          { name: 'amountCreditLD', type: 'uint256' },
        ],
        name: 'oftReceipt',
        type: 'tuple',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

/** Address to bytes32 (left-padded). */
function addressToBytes32(addr: string): `0x${string}` {
  const hex = addr.slice(2).toLowerCase().padStart(64, '0')
  return (`0x${hex}`) as `0x${string}`
}

/** amount/1e18 truncated to 4 decimal places, then * 1e18. E.g. 0.00125678 -> 0.0012 -> 1200000000000000. Avoids minAmountLD precision errors. */
function minAmountLDWith4Decimals(amountLD: bigint): bigint {
  const FOUR_DECIMALS_WEI = 10n ** 14n // 1e18 / 1e4
  return (amountLD / FOUR_DECIMALS_WEI) * FOUR_DECIMALS_WEI
}

export function getBridgeQuote(request: BridgeQuoteRequest): Promise<BridgeQuoteResult> {
  const {
    sourceChainId,
    destChainId,
    token,
    amount,
    recipient,
    sourceRpcUrl,
  } = request

  assertSupportedChains(sourceChainId, destChainId)
  if (amount <= 0n) {
    throw new Error('Bridge amount must be greater than 0.')
  }
  if (!isAddress(recipient)) {
    throw new Error('Recipient must be a valid address.')
  }

  const { address: oftAddress, tokenKey } = resolveOftAddress(sourceChainId, token)
  const dstEid = getEidByChainId(destChainId)
  const rpcUrl = sourceRpcUrl ?? DEFAULT_RPC_BY_CHAIN[sourceChainId]
  if (!rpcUrl) {
    throw new Error('Source RPC URL is required.')
  }
  const client = createPublicClient({
    chain: {
      id: sourceChainId,
      name: sourceChainId === 8453 ? 'Base' : 'Ethereum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  })

  const sendParam = {
    dstEid,
    to: addressToBytes32(recipient),
    amountLD: amount,
    minAmountLD: minAmountLDWith4Decimals(amount),
    extraOptions: getExtraOptions(tokenKey),
    composeMsg: '0x' as `0x${string}`,
    oftCmd: '0x' as `0x${string}`,
  }

  return client
    .readContract({
      address: oftAddress,
      abi: OFT_ABI,
      functionName: 'quoteSend',
      args: [sendParam, false],
    })
    .then((fee) => ({
      nativeFee: fee.nativeFee,
      lzTokenFee: fee.lzTokenFee,
    }))
}

export async function buildBridgeTx(
  request: BuildBridgeTxRequest
): Promise<BuildBridgeTxResult> {
  const {
    sourceChainId,
    destChainId,
    token,
    amount,
    recipient,
    refundAddress,
    sourceRpcUrl,
  } = request

  assertSupportedChains(sourceChainId, destChainId)
  if (amount <= 0n) {
    throw new Error('Bridge amount must be greater than 0.')
  }
  if (!isAddress(recipient)) {
    throw new Error('Recipient must be a valid address.')
  }

  const quote = await getBridgeQuote(request)
  const refund = refundAddress && isAddress(refundAddress) ? refundAddress : recipient
  const { address: oftAddress, tokenKey } = resolveOftAddress(sourceChainId, token)
  const dstEid = getEidByChainId(destChainId)

  const sendParam = {
    dstEid,
    to: addressToBytes32(recipient),
    amountLD: amount,
    minAmountLD: minAmountLDWith4Decimals(amount),
    extraOptions: getExtraOptions(tokenKey),
    composeMsg: '0x' as `0x${string}`,
    oftCmd: '0x' as `0x${string}`,
  }

  const data = encodeFunctionData({
    abi: OFT_ABI,
    functionName: 'send',
    args: [
      sendParam,
      { nativeFee: quote.nativeFee, lzTokenFee: quote.lzTokenFee },
      refund as Address,
    ],
  })

  return {
    tx: {
      to: oftAddress,
      data,
      value: quote.nativeFee,
    },
    quote,
  }
}
