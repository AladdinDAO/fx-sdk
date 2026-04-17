import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockInfo() {
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

  console.log(`Querying veFXN lock info for: ${userAddress}\n`)

  try {
    const info = await sdk.getLockInfo({ userAddress })
    console.log('Lock status:', info.lockStatus)
    console.log('Locked amount (wei):', info.lockedAmount.toString())
    console.log('Lock end:', info.lockEnd > 0n ? new Date(Number(info.lockEnd) * 1000).toISOString() : 'N/A')
    console.log('vePower (wei):', info.vePower.toString())
    console.log('veTotalSupply (wei):', info.veTotalSupply.toString())
    console.log('Pending wstETH (wei):', info.pendingWstETH.toString())
    console.log('Delegated balance (wei):', info.delegatedBalance.toString())
    console.log('Delegable balance (wei):', info.delegableBalance.toString())
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

lockInfo()
