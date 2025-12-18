import axios from 'axios'
import { Aggregator, ROUTE_TYPES } from '@/core/aggregators/types'

const ODOS_BASE_URL = 'https://api.odos.xyz'
const ODOS_REFERRAL_CODE = '770654120'

const http = axios.create({
  timeout: 15 * 1000,
})

function e2z(address: string) {
  const ethAddrRegex = /^0x[eE]{40}$/i
  if (ethAddrRegex.test(address)) {
    return `0x${'0'.repeat(40)}`
  }
  return address
}

export class Odos extends Aggregator {
  readonly referralCode: string

  constructor(referralCode?: string) {
    super(ROUTE_TYPES.ODOS)
    this.referralCode = referralCode ?? ODOS_REFERRAL_CODE
  }

  async getQuote({
    src,
    dst,
    amount,
    chainId = 1,
  }: {
    src: string
    dst: string
    amount: bigint
    chainId?: number
  }) {
    const response = await http.post(`${ODOS_BASE_URL}/sor/quote/v2`, {
      chainId,
      inputTokens: [
        {
          tokenAddress: e2z(src),
          amount: amount.toString(),
        },
      ],
      outputTokens: [{ tokenAddress: e2z(dst), proportion: 1 }],
      referralCode: ODOS_REFERRAL_CODE,
      sourceBlacklist: ['Fluid', 'Curve TwoCrypto NG'],
    })
    return {
      name: this.name,
      src: BigInt(response.data?.inAmounts?.[0]),
      dst: BigInt(response.data?.outAmounts?.[0]),
    }
  }

  async getRoute({
    src,
    dst,
    amount,
    slippage,
    receiver,
    chainId = 1,
  }: {
    src: string
    dst: string
    amount: bigint
    slippage: number
    receiver: string
    chainId?: number
  }) {
    const quoteRes = await http.post(`${ODOS_BASE_URL}/sor/quote/v2`, {
      chainId,
      userAddr: receiver,
      inputTokens: [
        {
          tokenAddress: e2z(src),
          amount: amount.toString(),
        },
      ],
      outputTokens: [{ tokenAddress: e2z(dst), proportion: 1 }],
      slippageLimitPercent: slippage,
      referralCode: ODOS_REFERRAL_CODE,
      sourceBlacklist: ['Fluid', 'Curve TwoCrypto NG'],
    })

    const pathId = quoteRes.data?.pathId
    if (!pathId) {
      throw new Error('Missing pathId from quote response')
    }

    const assembleRes = await http.post(`${ODOS_BASE_URL}/sor/assemble`, {
      userAddr: receiver,
      pathId,
    })

    const tx = assembleRes.data?.transaction
    const input = assembleRes.data?.inputTokens?.[0]?.amount
    const output = assembleRes.data?.outputTokens?.[0]?.amount

    if (!tx?.to || !tx?.data || !input || !output) {
      throw new Error('Missing transaction data from assemble response')
    }

    return {
      name: this.name,
      to: tx.to,
      data: tx.data,
      src: BigInt(input),
      dst: BigInt(output),
    }
  }
}
