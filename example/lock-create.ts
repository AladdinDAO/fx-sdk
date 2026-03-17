import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockCreate() {
  let userAddress = process.env.USER_ADDRESS
  if (!userAddress && process.env.PRIVATE_KEY) {
    const { privateKeyToAccount } = await import('viem/accounts')
    const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
    userAddress = privateKeyToAccount(privateKey).address
  }
  if (!userAddress) {
    throw new Error('USER_ADDRESS or PRIVATE_KEY must be set in .env')
  }

  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1
  const sdk = new FxSdk({ rpcUrl, chainId })

  console.log(`Creating veFXN lock for: ${userAddress}\n`)

  try {
    // Check current lock status
    const info = await sdk.getLockInfo({ userAddress })
    console.log('Current lock status:', info.lockStatus)

    if (info.lockStatus !== 'no-lock') {
      console.log('User already has a lock. Use increaseLockAmount or extendLockTime instead.')
      return
    }

    // Create a 1-year lock for 100 FXN
    const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
    const result = await sdk.createLock({
      userAddress,
      amount: 100n * 10n ** 18n, // 100 FXN
      unlockTime: oneYear,
    })

    console.log(`\nTransactions to execute: ${result.txs.length}`)
    result.txs.forEach((tx, i) => {
      console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
    })
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

lockCreate()
