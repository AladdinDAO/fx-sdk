import axios from 'axios'
import Decimal from 'decimal.js'
import { Aggregator, ROUTE_TYPES } from '@/core/aggregators/types'
import { getDecimals } from '@/utils/service'

const PARA_BASE_URL = 'https://api.paraswap.io'

const http = axios.create({
  timeout: 15 * 1000,
})

export class Velora extends Aggregator {
  constructor() {
    super(ROUTE_TYPES.Velora)
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
    const srcDecimals = await getDecimals(src)
    const dstDecimals = await getDecimals(dst)
    const response = await http.get(`${PARA_BASE_URL}/prices`, {
      params: {
        srcToken: src,
        destToken: dst,
        amount,
        network: chainId,
        version: '6.2',
        side: 'SELL',
        srcDecimals: srcDecimals,
        destDecimals: dstDecimals,
        partner: 'fx-protocol',
      },
    })

    if (
      !response.data?.priceRoute?.srcAmount ||
      !response.data?.priceRoute?.destAmount
    ) {
      throw new Error('Missing price route in response')
    }

    return {
      name: this.name,
      src: BigInt(response.data?.priceRoute?.srcAmount),
      dst: BigInt(response.data?.priceRoute?.destAmount),
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
    const srcDecimals = await getDecimals(src)
    const dstDecimals = await getDecimals(dst)

    const priceResponse = await http.get(`${PARA_BASE_URL}/prices`, {
      params: {
        srcToken: src,
        destToken: dst,
        amount,
        network: chainId,
        version: '6.2',
        side: 'SELL',
        srcDecimals: srcDecimals,
        destDecimals: dstDecimals,
        partner: 'fx-protocol',
      },
    })

    const response = await http.post(
      `${PARA_BASE_URL}/transactions/1`,
      {
        srcToken: src,
        destToken: dst,
        srcAmount: amount.toString(),
        priceRoute: priceResponse.data?.priceRoute,
        srcDecimals: srcDecimals,
        destDecimals: dstDecimals,
        slippage: Decimal(slippage).mul(100).round().toString(),
        userAddress: receiver,
        partner: 'fx-protocol',
      },
      {
        params: {
          ignoreChecks: true,
          ignoreGasEstimate: true,
        },
      }
    )
    const tx = response.data
    const pr = priceResponse.data?.priceRoute

    if (!tx?.to || !tx?.data || !pr?.srcAmount || !pr?.destAmount) {
      throw new Error('Missing transaction data in response')
    }

    return {
      name: this.name,
      to: tx?.to,
      data: tx?.data,
      src: BigInt(pr?.srcAmount),
      dst: BigInt(pr?.destAmount),
    }
  }
}
