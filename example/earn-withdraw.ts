import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function earnWithdraw() {
  let userAddress = process.env.USER_ADDRESS
  if (!userAddress && process.env.PRIVATE_KEY) {
    const { privateKeyToAccount } = await import('viem/accounts')
    const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
    userAddress = privateKeyToAccount(privateKey).address
  }
  if (!userAddress) throw new Error('USER_ADDRESS or PRIVATE_KEY must be set in .env')

  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1
  const sdk = new FxSdk({ rpcUrl, chainId })

  // Use gauge from env or fall back to first gauge
  const gaugeAddress = process.env.GAUGE_ADDRESS
  if (!gaugeAddress) throw new Error('GAUGE_ADDRESS must be set in .env (get from earn-gauge-list)')

  console.log(`Building Earn withdraw for: ${userAddress}`)
  console.log(`Gauge: ${gaugeAddress}\n`)

  // Check current position
  const pos = await sdk.getEarnPosition({ userAddress, gaugeAddress })
  console.log(`Staked balance: ${pos.stakedBalance}`)

  if (pos.stakedBalance === 0n) {
    console.log('No staked LP tokens to withdraw.')
    process.exit(0)
  }

  // Withdraw half as example
  const amount = pos.stakedBalance / 2n
  console.log(`Withdrawing: ${amount} (50% of staked)\n`)

  const result = await sdk.earnWithdraw({ userAddress, gaugeAddress, amount })

  console.log(`Transactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
}

earnWithdraw().catch(e => { console.error(e.message); process.exit(1) })
