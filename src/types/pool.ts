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
  // isBorrowAllowed: boolean
  // isBorrowPaused: boolean
  // isStableRepayAllowed: boolean

  anchorPrice: string
  minPrice: string
  maxPrice: string

  collRest: bigint
  debtRest: bigint
  rateRes: bigint

  averagePrice: string
  openPrice: string
  closePrice: string

  // poolMinDebtRatio: string
  // poolMaxDebtRatio: string

  // openFeeRatio: string
  // closeFeeRatio: string
  // borrowFeeRatio: string
  // repayFeeRatio: string
}
