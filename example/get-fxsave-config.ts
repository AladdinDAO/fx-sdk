/**
 * Query fxSAVE protocol totals and config (total supply, total assets, cooldown period, fee ratios).
 * Run: npm run example:fxsave-config
 */
import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function getFxSaveConfig() {
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1
  const sdk = new FxSdk({ rpcUrl, chainId })

  console.log('Querying fxSAVE protocol config...\n')

  try {
    const result = await sdk.getFxSaveConfig()
    console.log('--- Totals ---')
    console.log('Total supply (shares wei):', result.totalSupplyWei.toString())
    console.log('Total assets (wei):', result.totalAssetsWei.toString())
    console.log('\n--- Config ---')
    console.log('Cooldown period (seconds):', result.cooldownPeriodSeconds.toString())
    console.log('Instant redeem fee ratio (wei):', result.instantRedeemFeeRatio.toString())
    console.log('Expense ratio (wei):', result.expenseRatio.toString())
    console.log('Harvester ratio (wei):', result.harvesterRatio.toString())
    console.log('Threshold (wei):', result.threshold.toString())
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

getFxSaveConfig()
