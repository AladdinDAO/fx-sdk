import { ROUTE_TYPES } from '@/core/aggregators/types'

interface FlashLoanQuoteParams {
  routeType: ROUTE_TYPES
  positionLeverage: number
  minOut: string
  slippage: number
  positionId: number
  curPrice: string
  realPrice: string
  priceImpact: string
  dataSource: [bigint, bigint, string, string]
  colls: string
  debts: string
}

export interface OpenOrAddFlashLoanQuote {
  params: FlashLoanQuoteParams
  data: [
    {
      tokenIn: string
      amount: bigint
      target: string
      data: string
      minOut: string
      signature: string
    },
    poolAddress: string,
    positionId: number,
    borrowAmount: string,
    data: string
  ]
}

export interface CloseOrRemoveFlashLoanQuote {
  params: FlashLoanQuoteParams
  data: [
    {
      tokenOut: string,
      converter: string,
      encodings: bigint,
      routes: string[],
      minOut: string,
      signature: string
    },
    poolAddress: string,
    positionId: number,
    amountOut: string,
    borrowAmount: string,
    data: string,
  ]
}
