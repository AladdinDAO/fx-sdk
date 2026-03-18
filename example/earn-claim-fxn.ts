import { FxSdk } from '../src'
import { formatEther, createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function earnClaimFxn() {
  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY must be set in .env')
  if (!process.env.GAUGE_ADDRESS) throw new Error('GAUGE_ADDRESS must be set in .env (get from earn-gauge-list)')

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

  const gaugeAddress = process.env.GAUGE_ADDRESS
  const sdk          = new FxSdk({ rpcUrl, chainId })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  console.log(`Claim FXN rewards for: ${userAddress}`)
  console.log(`Gauge: ${gaugeAddress}\n`)

  // Check pending FXN before claiming
  const pos = await sdk.getEarnPosition({ userAddress, gaugeAddress })
  console.log(`Pending FXN: ${formatEther(pos.pendingFxn)}`)
  console.log(`Staked LP:   ${formatEther(pos.stakedBalance)}\n`)

  // claimFxn calls TokenMinter.mint(gaugeAddress) — always sends the tx even if pendingFxn is 0
  const result = await sdk.claimFxn({ userAddress, gaugeAddress })
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

  console.log('\n✅ Done')
}

earnClaimFxn().catch(e => {
  console.error('Claim FXN failed:', { message: e.message, stack: e.stack })
  process.exit(1)
})
