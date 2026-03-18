import { FxSdk } from '../src'
import { formatEther, parseEther, createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function lockIncrease() {
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

  // Amount: LOCK_AMOUNT_FXN env var (decimal string) or default 10 FXN
  let amount: bigint
  if (process.env.LOCK_AMOUNT_FXN) {
    const raw = process.env.LOCK_AMOUNT_FXN.trim()
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid LOCK_AMOUNT_FXN: "${raw}"`)
    amount = parseEther(raw as `${number}`)
    if (amount <= 0n) throw new Error('LOCK_AMOUNT_FXN must be greater than 0')
  } else {
    amount = 10n * 10n ** 18n
  }

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  console.log('=== Increase Lock Amount ===')
  console.log('Address:', userAddress)

  const before = await sdk.getLockInfo({ userAddress })
  console.log('\n[Before]')
  console.log('  lock status: ', before.lockStatus)
  console.log('  lockedAmount:', formatEther(before.lockedAmount), 'FXN')
  console.log('  lockEnd:     ', before.lockEnd > 0n ? new Date(Number(before.lockEnd) * 1000).toISOString() : 'N/A')
  console.log('  vePower:     ', formatEther(before.vePower))

  if (before.lockStatus !== 'active') {
    console.log(`\n⚠️  Lock status is '${before.lockStatus}'. Need an active lock to increase amount.`)
    process.exit(0)
  }

  console.log(`\nAdding ${formatEther(amount)} FXN to existing lock...`)
  const result = await sdk.increaseLockAmount({ userAddress, amount })
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
  console.log('  lockedAmount:', formatEther(after.lockedAmount), 'FXN')
  console.log('  vePower:     ', formatEther(after.vePower))
  console.log('\n✅ Done')
}

lockIncrease().catch(e => {
  console.error('Lock increase failed:', { message: e.message, stack: e.stack })
  process.exit(1)
})
