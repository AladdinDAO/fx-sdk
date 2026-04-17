import { FxSdk } from '../src'
import { formatEther, parseEther, createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockCreate() {
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

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  // Amount: LOCK_AMOUNT_FXN env var or default 100 FXN
  let amount: bigint
  if (process.env.LOCK_AMOUNT_FXN) {
    const raw = process.env.LOCK_AMOUNT_FXN.trim()
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid LOCK_AMOUNT_FXN: "${raw}"`)
    amount = parseEther(raw as `${number}`)
    if (amount <= 0n) throw new Error('LOCK_AMOUNT_FXN must be greater than 0')
  } else {
    amount = 100n * 10n ** 18n
  }

  // Lock duration: LOCK_DAYS env var or default 365 days
  const lockDays = process.env.LOCK_DAYS ? parseInt(process.env.LOCK_DAYS, 10) : 365
  if (isNaN(lockDays) || lockDays <= 0) throw new Error(`Invalid LOCK_DAYS: ${process.env.LOCK_DAYS}`)
  const unlockTime = Math.floor(Date.now() / 1000) + lockDays * 86400

  console.log('=== Create veFXN Lock ===')
  console.log('Address:', userAddress)

  const before = await sdk.getLockInfo({ userAddress })
  console.log('\n[Before] lock status:', before.lockStatus)
  console.log('[Before] vePower:    ', formatEther(before.vePower))

  if (before.lockStatus !== 'no-lock') {
    console.log(`\n⚠️  Already has a lock (${before.lockStatus}). Use lock-increase or lock-extend instead.`)
    process.exit(0)
  }

  console.log(`\nLocking ${formatEther(amount)} FXN for ${lockDays} days...`)
  const result = await sdk.createLock({ userAddress, amount, unlockTime })
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
  console.log('  lock status: ', after.lockStatus)
  console.log('  lockedAmount:', formatEther(after.lockedAmount), 'FXN')
  console.log('  lockEnd:     ', new Date(Number(after.lockEnd) * 1000).toISOString())
  console.log('  vePower:     ', formatEther(after.vePower))
  console.log('\n✅ Done')
}

lockCreate().catch(e => {
  console.error('Lock create failed:', { message: e.message, stack: e.stack })
  process.exit(1)
})
