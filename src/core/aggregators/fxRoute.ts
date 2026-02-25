import { contracts } from '@/configs/contracts'
import { getZapRoutes } from '@/utils/zapRoute'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { encodeFunctionData } from 'viem'
import { Aggregator, ROUTE_TYPES } from '@/core/aggregators/types'
import { getQueryConvert } from '@/utils/service'

export class FxRoute extends Aggregator {
  private isV3: boolean

  constructor(isV3?: boolean) {
    super(isV3 ? ROUTE_TYPES.FX_ROUTE_V3 : ROUTE_TYPES.FX_ROUTE)
    this.isV3 = isV3 ?? false
  }

  async getQuote({
    src,
    dst,
    amount,
  }: {
    src: string
    dst: string
    amount: bigint
  }) {
    const convertData = getZapRoutes({
      fromTokenAddress: src,
      toTokenAddress: dst,
      isV3: this.isV3,
    })

    if (!convertData) {
      throw new Error(`Conversion route not found for ${src} to ${dst}`)
    }

    const outAmount = await getQueryConvert(amount, convertData)

    return {
      name: this.name,
      src: amount,
      dst: outAmount,
      convertData,
    }
  }

  async getRoute({
    src,
    dst,
    amount,
  }: {
    src: string
    dst: string
    amount: bigint
  }) {
    const quote = await this.getQuote({ src, dst, amount })

    return {
      name: this.name,
      to: contracts.TokenConverter_MultiPathConverter,
      data: encodeFunctionData({
        abi: MultiPathConverterAbi,
        functionName: 'convert',
        args: [
          src,
          amount,
          quote.convertData.encoding,
          quote.convertData.routes,
        ],
      }),
      src: quote.src,
      dst: quote.dst,
    }
  }
}
