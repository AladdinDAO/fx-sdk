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

  const account = privateKeyToAccount(pk)
  const userAddress = account.address
  const rpcUrl = process.env.RPC_URL!
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  const chain = defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const sdk = new FxSdk({ rpcUrl, chainId })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  console.log('=== Lock FXN ===')
  console.log('Address:', userAddress)

  // 1. Check current status
  const before = await sdk.getLockInfo({ userAddress })
  console.log('\n[Before] lock status:', before.lockStatus)
  console.log('[Before] vePower:', formatEther(before.vePower))

  // 2. Build lock txs: 100 FXN, 1 year
  const oneYear = Math.floor(Date.now() / 1000) + 365 * 86400
  const amount = 100n * 10n ** 18n  // 100 FXN

  console.log(`\nLocking ${formatEther(amount)} FXN for 1 year...`)
  const result = await sdk.createLock({ userAddress, amount, unlockTime: oneYear })
  console.log(`Transactions to send: ${result.txs.length}`)

  // 3. Send each tx
  for (let i = 0; i < result.txs.length; i++) {
    const tx = result.txs[i]
    console.log(`\n[${i + 1}/${result.txs.length}] ${tx.type} → ${tx.to}`)

    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: tx.value ?? 0n,
    })
    console.log('  tx hash:', hash)

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('  status:', receipt.status, '| block:', receipt.blockNumber.toString())
  }

  // 4. Verify new lock state
  const after = await sdk.getLockInfo({ userAddress })
  console.log('\n[After] lock status:', after.lockStatus)
  console.log('[After] lockedAmount:', formatEther(after.lockedAmount), 'FXN')
  console.log('[After] lockEnd:', new Date(Number(after.lockEnd) * 1000).toISOString())
  console.log('[After] vePower:', formatEther(after.vePower))
  console.log('\n✅ Done')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
