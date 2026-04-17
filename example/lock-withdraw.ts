import { FxSdk } from '../src'
import { formatEther } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockWithdraw() {
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

  console.log(`Building Lock withdraw for: ${userAddress}\n`)

  const info = await sdk.getLockInfo({ userAddress })
  console.log('Lock status:   ', info.lockStatus)
  console.log('Locked amount: ', formatEther(info.lockedAmount), 'FXN')
  console.log('Lock end:      ', info.lockEnd > 0n
    ? new Date(Number(info.lockEnd) * 1000).toISOString()
    : 'N/A')

  if (info.lockStatus !== 'expired') {
    console.log(`\n⚠️  Cannot withdraw: lock is '${info.lockStatus}'. Wait until lockEnd has passed.`)
    process.exit(0)
  }

  const result = await sdk.withdrawLock({ userAddress })

  console.log(`\nTransactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
}

lockWithdraw().catch(e => { console.error(e.message); process.exit(1) })
