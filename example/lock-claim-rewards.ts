import { FxSdk } from '../src'
import { formatEther } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockClaimRewards() {
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

  console.log(`Claiming Lock rewards (wstETH) for: ${userAddress}\n`)

  const info = await sdk.getLockInfo({ userAddress })
  console.log('Lock status:     ', info.lockStatus)
  console.log('vePower:         ', formatEther(info.vePower))
  console.log('Pending wstETH:  ', formatEther(info.pendingWstETH))
  console.log('Weekly fee dist: ', formatEther(info.weeklyFeeAmount), 'wstETH')

  if (info.lockStatus === 'no-lock') {
    console.log('\n⚠️  No active lock — no rewards to claim.')
    process.exit(0)
  }

  // claimLockRewards calls FeeDistributor.claim → receives wstETH
  const result = await sdk.claimLockRewards({ userAddress })

  console.log(`\nTransactions to execute: ${result.txs.length}`)
  result.txs.forEach((tx, i) => {
    console.log(`  [${i + 1}] ${tx.type}: to=${tx.to}`)
  })
}

lockClaimRewards().catch(e => { console.error(e.message); process.exit(1) })
