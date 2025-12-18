export enum ROUTE_TYPES {
  Velora = 'Velora',
  ODOS = 'Odos',
  FX_ROUTE = 'FxRoute',
  FX_ROUTE_V3 = 'FxRoute 2',
}

export type QuoteResult = {
  name: ROUTE_TYPES
  src: bigint
  dst: bigint
  convertData?: {
    encoding: bigint
    routes: string[]
  }
}

export type RouteResult = {
  name: ROUTE_TYPES
  to: string
  data: string
  src: bigint
  dst: bigint
}

export abstract class Aggregator {
  public readonly name: ROUTE_TYPES

  constructor(name: ROUTE_TYPES) {
    this.name = name
  }

  abstract getQuote(params: {
    src: string
    dst: string
    amount: bigint
  }): Promise<QuoteResult>

  abstract getRoute(params: {
    src: string
    dst: string
    amount: bigint
  }): Promise<RouteResult>
}
