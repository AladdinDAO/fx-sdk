import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function earnClaimRewards() {
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

  const gaugeAddress = process.env.GAUGE_ADDRESS
  if (!gaugeAddress) throw new Error('GAUGE_ADDRESS must be set in .env (get from earn-gauge-list)')

  // Optional: receiver overrides destination (defaults to userAddress)
  const receiver = process.env.RECEIVER_ADDRESS || undefined

  console.log(`Claiming extra rewards for: ${userAddress}`)
  console.log(`Gauge: ${gaugeAddress}`)
  if (receiver) console.log(`Receiver: ${receiver}`)
  console.log()

  // Check pending rewards before claiming
  const pos = await sdk.getEarnPosition({ userAddress, gaugeAddress })
  const rewardEntries = Object.entries(pos.pendingRewards)
  if (rewardEntries.length > 0) {
    console.log('Pending rewards:')
    rewardEntries.forEach(([token, amount]) => console.log(`  ${token}: ${amount}`))
  } else {
    console.log('No pending extra rewards detected (pendingRewards map is empty).')
  }

  const result = await sdk.claimRewards({ userAddress, gaugeAddress, receiver })

  console.log(`\nTransactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
  // Note: calls gauge.claim(userAddress, receiver)
}

earnClaimRewards().catch(e => { console.error(e.message); process.exit(1) })
