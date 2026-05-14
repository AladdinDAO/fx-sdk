import { FxSdk, tokens } from '../src'
import { Pool } from '../src/core/pool'
import { PoolName } from '../src/types/pool'
import { parseEther } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

/**
 * Read-only fxMINT overview: prints the SDK-level core data for each long
 * market — pool ratios + fees, the user's positions with LTV / liquidation
 * brake / leverage, and the mintable / withdrawable ranges for a sample input.
 */

const MARKETS: Array<{
  label: string
  market: 'ETH' | 'BTC'
  poolName: PoolName
  collDecimals: number
  collAddress: string
  sampleDeposit: bigint
  sampleRepay: bigint
}> = [
  {
    label: 'fxMINT (wstETH / fxUSD)',
    market: 'ETH',
    poolName: PoolName.wstETH,
    collDecimals: 18,
    collAddress: tokens.wstETH,
    sampleDeposit: parseEther('1'),
    sampleRepay: parseEther('1000'),
  },
  {
    label: 'fxMINT (WBTC / fxUSD)',
    market: 'BTC',
    poolName: PoolName.WBTC,
    collDecimals: 8,
    collAddress: tokens.WBTC,
    sampleDeposit: BigInt(1e8),
    sampleRepay: parseEther('1000'),
  },
]

function fmt(n: bigint, decimals: number, digits = 6) {
  const s = n.toString().padStart(decimals + 1, '0')
  const i = s.slice(0, s.length - decimals)
  const f = s.slice(s.length - decimals)
  return `${i}.${f.slice(0, digits)}`
}

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  let userAddress = process.env.USER_ADDRESS
  if (!userAddress && process.env.PRIVATE_KEY) {
    const { privateKeyToAccount } = await import('viem/accounts')
    const pk = process.env.PRIVATE_KEY.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
    userAddress = privateKeyToAccount(pk).address
  }
  if (!userAddress) {
    throw new Error('Either USER_ADDRESS or PRIVATE_KEY must be set in .env')
  }

  const sdk = new FxSdk({ rpcUrl, chainId })

  for (const cfg of MARKETS) {
    console.log(`\n=== ${cfg.label} ===`)

    const pool = new Pool({ poolName: cfg.poolName })
    const info = await pool.getPoolInfo()

    console.log('Pool')
    console.log(`  borrowFeeRatio:   ${(info.borrowFeeRatio * 100).toFixed(4)}%`)
    console.log(`  repayFeeRatio:    ${(info.repayFeeRatio * 100).toFixed(4)}%`)
    console.log(`  isPaused:         ${info.isPaused}`)

    const positions = await sdk.getPositions({
      userAddress,
      market: cfg.market,
      type: 'long',
    })

    console.log(`\nPositions for ${userAddress}: ${positions.length}`)
    positions.forEach((p, i) => {
      console.log(`  [${i + 1}] #${p.positionId}`)
      console.log(`      MINTED:      ${fmt(p.rawDebts, 18, 4)} fxUSD`)
      console.log(`      COLLATERAL:  ${fmt(p.rawColls, cfg.collDecimals, 6)} ${p.rawCollsToken}`)
      console.log(`      Leverage:    ${p.currentLeverage.toFixed(2)}x`)
    })

    const positionId = positions[0]?.positionId ?? 0

    const mintRange = await sdk.getFxMintMintableRange({
      market: cfg.market,
      positionId,
      userAddress,
      depositTokenAddress: cfg.collAddress,
      depositAmount: cfg.sampleDeposit,
    })
    console.log(`\nMintable range (deposit ${fmt(cfg.sampleDeposit, cfg.collDecimals, 6)} ${cfg.poolName}):`)
    console.log(`  min: ${fmt(mintRange.minMint, 18, 4)} fxUSD`)
    console.log(`  max: ${fmt(mintRange.maxMint, 18, 4)} fxUSD`)

    if (positionId > 0) {
      const wrange = await sdk.getFxMintWithdrawableRange({
        market: cfg.market,
        positionId,
        userAddress,
        repayAmount: cfg.sampleRepay,
        withdrawTokenAddress: cfg.collAddress,
      })
      console.log(`\nWithdrawable range (repay ${fmt(cfg.sampleRepay, 18, 4)} fxUSD):`)
      console.log(`  min: ${fmt(wrange.minWithdraw, cfg.collDecimals, 6)} ${cfg.poolName}`)
      console.log(`  max: ${fmt(wrange.maxWithdraw, cfg.collDecimals, 6)} ${cfg.poolName}`)
      console.log(`  isClose: ${wrange.isClose}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
