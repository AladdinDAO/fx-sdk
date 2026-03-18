import { FxSdk } from '../src'
import { parseAbi, formatEther, parseEther, createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)'])

async function earnDeposit() {
  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY must be set in .env')

  const rawPk = process.env.PRIVATE_KEY
  const pk = rawPk.startsWith('0x') ? rawPk as `0x${string}` : `0x${rawPk}` as `0x${string}`
  const account     = privateKeyToAccount(pk)
  const userAddress = account.address
  const rpcUrl      = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'

  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 1
  if (isNaN(chainId) || chainId <= 0) throw new Error(`Invalid CHAIN_ID: ${process.env.CHAIN_ID}`)

  const chain = defineChain({
    id: chainId, name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  console.log(`Earn deposit for: ${userAddress}\n`)

  // ── Resolve gauge + LP address ──
  let gaugeAddress   = process.env.GAUGE_ADDRESS ?? ''
  let lpTokenAddress = process.env.LP_TOKEN_ADDRESS ?? ''
  let gaugeName      = 'custom'

  if (!gaugeAddress || !lpTokenAddress) {
    const { gauges } = await sdk.getGaugeList()
    if (!gauges || gauges.length === 0) throw new Error('No gauges from API. Set GAUGE_ADDRESS + LP_TOKEN_ADDRESS in .env.')

    if (gaugeAddress) {
      // Have gauge but missing LP — look it up
      const found = gauges.find(g => g.gauge.toLowerCase() === gaugeAddress.toLowerCase())
      if (!found) throw new Error(`Gauge ${gaugeAddress} not found in gauge list. Also set LP_TOKEN_ADDRESS manually.`)
      lpTokenAddress = found.lpAddress
      gaugeName      = found.name
    } else {
      // Use first gauge
      const g        = gauges[0]
      gaugeAddress   = g.gauge
      lpTokenAddress = g.lpAddress
      gaugeName      = g.name
    }
  }

  console.log(`Gauge: ${gaugeName} (${gaugeAddress})`)
  console.log(`LP:    ${lpTokenAddress}`)

  // ── Check LP balance ──
  const lpBal = await publicClient.readContract({
    address: lpTokenAddress as `0x${string}`,
    abi: erc20,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
  }) as bigint

  console.log(`LP balance: ${formatEther(lpBal)}`)

  if (lpBal === 0n) {
    console.log('\n⚠️  No LP tokens in wallet. Nothing to deposit.')
    process.exit(0)
  }

  // ── Parse deposit amount (safe: use parseEther, not parseFloat * 1e18) ──
  let amount: bigint
  if (process.env.DEPOSIT_AMOUNT_LP) {
    const raw = process.env.DEPOSIT_AMOUNT_LP.trim()
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`Invalid DEPOSIT_AMOUNT_LP: "${raw}". Use a decimal number e.g. "1.5"`)
    amount = parseEther(raw as `${number}`)
    if (amount <= 0n) throw new Error('DEPOSIT_AMOUNT_LP must be greater than 0')
    if (amount > lpBal) throw new Error(`DEPOSIT_AMOUNT_LP (${formatEther(amount)}) exceeds LP balance (${formatEther(lpBal)})`)
  } else {
    amount = lpBal
  }

  console.log(`Depositing: ${formatEther(amount)} LP\n`)

  // ── Build + send txs ──
  const result = await sdk.earnDeposit({ userAddress, gaugeAddress, lpTokenAddress, amount })
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
    if (receipt.status !== 'success') throw new Error(`Transaction ${i + 1} reverted (hash: ${hash})`)
  }

  // ── Final state ──
  const pos = await sdk.getEarnPosition({ userAddress, gaugeAddress })
  console.log(`\nStaked balance after: ${formatEther(pos.stakedBalance)} LP`)
  console.log('✅ Done')
}

earnDeposit().catch(e => {
  console.error('Earn deposit failed:', { message: e.message, stack: e.stack })
  process.exit(1)
})
