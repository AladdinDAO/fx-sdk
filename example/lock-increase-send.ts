import { FxSdk } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, formatEther, defineChain } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function main() {
  const pk = process.env.PRIVATE_KEY!.startsWith('0x')
    ? process.env.PRIVATE_KEY! as `0x${string}`
    : `0x${process.env.PRIVATE_KEY!}` as `0x${string}`

  const account     = privateKeyToAccount(pk)
  const userAddress = account.address
  const rpcUrl      = process.env.RPC_URL!
  const chainId     = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  const chain = defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const fxnAmount = process.env.LOCK_AMOUNT_FXN
    ? BigInt(Math.floor(parseFloat(process.env.LOCK_AMOUNT_FXN) * 1e18))
    : 10n * 10n ** 18n  // default: 10 FXN

  console.log('=== Increase Lock Amount ===')
  console.log('Address:', userAddress)

  const before = await sdk.getLockInfo({ userAddress })
  console.log('\n[Before]')
  console.log('  lockedAmount:', formatEther(before.lockedAmount), 'FXN')
  console.log('  vePower:     ', formatEther(before.vePower))

  if (before.lockStatus !== 'active') {
    console.log(`\n⚠️  lockStatus is '${before.lockStatus}'. Need an active lock.`)
    process.exit(1)
  }

  console.log(`\nAdding ${formatEther(fxnAmount)} FXN to existing lock...`)
  const result = await sdk.increaseLockAmount({ userAddress, amount: fxnAmount })
  console.log(`Transactions: ${result.txs.length}`)

  for (let i = 0; i < result.txs.length; i++) {
    const tx = result.txs[i]
    console.log(`\n[${i + 1}/${result.txs.length}] ${tx.type} → ${tx.to}`)
    const hash = await walletClient.sendTransaction({
      to:    tx.to   as `0x${string}`,
      data:  tx.data as `0x${string}`,
      value: tx.value ?? 0n,
    })
    console.log('  hash:', hash)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('  status:', receipt.status, '| block:', receipt.blockNumber.toString())
  }

  const after = await sdk.getLockInfo({ userAddress })
  console.log('\n[After]')
  console.log('  lockedAmount:', formatEther(after.lockedAmount), 'FXN')
  console.log('  vePower:     ', formatEther(after.vePower))
  console.log('\n✅ Done')
}

main().catch(e => { console.error(e.message); process.exit(1) })
