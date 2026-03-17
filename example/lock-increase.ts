import { FxSdk } from '../src'
import { formatEther } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockIncrease() {
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

  // Amount to add; override via LOCK_AMOUNT_FXN env var (in FXN, not wei)
  const fxnAmount = process.env.LOCK_AMOUNT_FXN
    ? BigInt(Math.floor(parseFloat(process.env.LOCK_AMOUNT_FXN) * 1e18))
    : 10n * 10n ** 18n  // default: 10 FXN

  console.log(`Building Lock increase for: ${userAddress}`)
  console.log(`Amount to add:  ${formatEther(fxnAmount)} FXN\n`)

  const info = await sdk.getLockInfo({ userAddress })
  console.log('Lock status:   ', info.lockStatus)
  console.log('Locked amount: ', formatEther(info.lockedAmount), 'FXN')
  console.log('Lock end:      ', info.lockEnd > 0n
    ? new Date(Number(info.lockEnd) * 1000).toISOString()
    : 'N/A')
  console.log('vePower:       ', formatEther(info.vePower))

  if (info.lockStatus !== 'active') {
    console.log(`\n⚠️  Cannot increase lock amount: status is '${info.lockStatus}'. Must have an active lock.`)
    process.exit(0)
  }

  // Returns approve FXN + increase_amount txs
  const result = await sdk.increaseLockAmount({ userAddress, amount: fxnAmount })

  console.log(`\nTransactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
}

lockIncrease().catch(e => { console.error(e.message); process.exit(1) })
