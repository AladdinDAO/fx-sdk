export enum PoolName {
  wstETH = 'wstETH',
  WBTC = 'WBTC',
  wstETH_short = 'wstETH_short',
  WBTC_short = 'WBTC_short',
}

export interface PoolConfig {
  isShort: boolean
  poolName: PoolName
  deltaCollAddress: string
  deltaDebtAddress: string
  deltaCollSymbol: string
  deltaDebtSymbol: string
  poolAddress: string
  oracle: string
  creditNote: string
  baseTokenSymbol: string
  lsdTokenSymbol: string
  marketSymbol: string
  collSymbol: string
  zapSymbol: string
  debtSymbol: string
  decimals: number
  minPrecision: number
  precision: number
  creditNoteSymbol: string
}

export interface PoolInfo extends PoolConfig {
  collateralCapacity: bigint
  collateralBalance: bigint
  rawCollateral: bigint
  debtCapacity: bigint
  debtBalance: bigint

  isPaused: boolean

  anchorPrice: string
  minPrice: string
  maxPrice: string

  collRest: bigint
  debtRest: bigint
  rateRes: bigint

  averagePrice: string
  openPrice: string
  closePrice: string

  poolMinDebtRatio: bigint
  poolMaxDebtRatio: bigint

  /** Leverage open fee ratio (number in `[0, 1]`, e.g. `0.001` = 10 bps). */
  openFeeRatio: number
  /** Leverage close fee ratio. */
  closeFeeRatio: number
  /** fxMINT deposit-and-mint fee ratio (e.g. `0.0005` = 5 bps). */
  borrowFeeRatio: number
  /** fxMINT repay-and-withdraw fee ratio. */
  repayFeeRatio: number
}
