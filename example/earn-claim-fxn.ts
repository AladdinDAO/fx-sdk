import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function earnClaimFxn() {
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

  console.log(`Claiming FXN rewards for: ${userAddress}`)
  console.log(`Gauge: ${gaugeAddress}\n`)

  // Check pending FXN before claiming
  const pos = await sdk.getEarnPosition({ userAddress, gaugeAddress })
  console.log(`Pending FXN: ${pos.pendingFxn}`)

  const result = await sdk.claimFxn({ userAddress, gaugeAddress })

  console.log(`\nTransactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
  // Note: claimFxn calls TokenMinter.mint(gaugeAddress) on contract 0xC8b194925D55d5dE9555AD1db74c149329F71DeF
}

earnClaimFxn().catch(e => { console.error(e.message); process.exit(1) })
