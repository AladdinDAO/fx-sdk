import { FxSdk } from '../src'
import { formatEther, createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockExtend() {
  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY must be set in .env')

  const rawPk = process.env.PRIVATE_KEY
  const pk = rawPk.startsWith('0x') ? rawPk as `0x${string}` : `0x${rawPk}` as `0x${string}`
  const account     = privateKeyToAccount(pk)
  const userAddress = account.address
  const rpcUrl      = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId     = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 1
  if (isNaN(chainId) || chainId <= 0) throw new Error(`Invalid CHAIN_ID: ${process.env.CHAIN_ID}`)

  const chain = defineChain({
    id: chainId, name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  // LOCK_DAYS: new lock end = NOW + LOCK_DAYS (absolute, must exceed current lock end)
  const lockDays = process.env.LOCK_DAYS ? parseInt(process.env.LOCK_DAYS, 10) : 365
  if (isNaN(lockDays) || lockDays <= 0) throw new Error(`Invalid LOCK_DAYS: ${process.env.LOCK_DAYS}`)
  const unlockTime = Math.floor(Date.now() / 1000) + lockDays * 86400

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  console.log('=== Extend Lock Time ===')
  console.log('Address:', userAddress)

  const before = await sdk.getLockInfo({ userAddress })
  console.log('\n[Before]')
  console.log('  lock status: ', before.lockStatus)
  console.log('  lockedAmount:', formatEther(before.lockedAmount), 'FXN')
  console.log('  lockEnd:     ', before.lockEnd > 0n ? new Date(Number(before.lockEnd) * 1000).toISOString() : 'N/A')
  console.log('  vePower:     ', formatEther(before.vePower))

  if (before.lockStatus !== 'active') {
    console.log(`\n⚠️  Lock status is '${before.lockStatus}'. Need an active lock to extend.`)
    process.exit(0)
  }

  if (unlockTime <= Number(before.lockEnd)) {
    console.log(`\n⚠️  New unlock time (${new Date(unlockTime * 1000).toISOString()}) must be after current lock end (${new Date(Number(before.lockEnd) * 1000).toISOString()}).`)
    console.log(`   Increase LOCK_DAYS (currently ${lockDays}) to a value that exceeds the remaining lock period.`)
    process.exit(1)
  }

  const newEnd = new Date(unlockTime * 1000).toISOString()
  console.log(`\nExtending lock to ${newEnd} (${lockDays} days from now)...`)
  const result = await sdk.extendLockTime({ userAddress, unlockTime })
  console.log(`Transactions: ${result.txs.length}`)

  for (let i = 0; i < result.txs.length; i++) {
    const tx = result.txs[i]
    console.log(`\n[${i + 1}/${result.txs.length}] ${tx.type} → ${tx.to}`)
    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: tx.value ?? 0n,
    })
    console.log('  hash:', hash)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('  status:', receipt.status, '| block:', receipt.blockNumber.toString())
    if (receipt.status !== 'success') throw new Error(`Transaction ${i + 1} reverted (hash: ${hash})`)
  }

  const after = await sdk.getLockInfo({ userAddress })
  console.log('\n[After]')
  console.log('  lockEnd: ', after.lockEnd > 0n ? new Date(Number(after.lockEnd) * 1000).toISOString() : 'N/A')
  console.log('  vePower: ', formatEther(after.vePower))
  console.log('\n✅ Done')
}

lockExtend().catch(e => {
  console.error('Lock extend failed:', { message: e.message, stack: e.stack })
  process.exit(1)
})
