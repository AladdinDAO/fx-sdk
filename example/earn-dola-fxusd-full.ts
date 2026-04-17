/**
 * DOLA+fxUSD Gauge: deposit → claim rewards → partial withdraw
 *
 * Gauge:    0x61F32964C39Cca4353144A6DB2F8Efdb3216b35B
 * LP token: 0x189b4e49b5caf33565095097b4b960f14032c7d0
 */
import { FxSdk } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, formatEther, parseAbi, defineChain } from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

const GAUGE     = '0x61F32964C39Cca4353144A6DB2F8Efdb3216b35B' as const
const LP_TOKEN  = '0x189b4e49b5caf33565095097b4b960f14032c7d0' as const

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)'])

async function sendTxs(txs: any[], walletClient: any, publicClient: any, label: string) {
  console.log(`\n--- ${label} (${txs.length} tx) ---`)
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]
    console.log(`[${i + 1}/${txs.length}] ${tx.type} → ${tx.to}`)
    const hash = await walletClient.sendTransaction({
      to:    tx.to   as `0x${string}`,
      data:  tx.data as `0x${string}`,
      value: tx.value ?? 0n,
    })
    console.log('  hash:', hash)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('  status:', receipt.status, '| block:', receipt.blockNumber.toString())
  }
}

async function main() {
  const pk = process.env.PRIVATE_KEY!.startsWith('0x')
    ? process.env.PRIVATE_KEY! as `0x${string}`
    : `0x${process.env.PRIVATE_KEY!}` as `0x${string}`

  const account      = privateKeyToAccount(pk)
  const userAddress  = account.address
  const rpcUrl       = process.env.RPC_URL!
  const chainId      = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  const chain = defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const sdk          = new FxSdk({ rpcUrl, chainId })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  console.log('=== DOLA+fxUSD Gauge Operations ===')
  console.log('User:', userAddress)

  // ── Step 0: balances before ──
  const lpWallet = await publicClient.readContract({ address: LP_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }) as bigint
  const lpStaked = await publicClient.readContract({ address: GAUGE,    abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }) as bigint
  console.log('\n[Before]')
  console.log('  LP in wallet:', formatEther(lpWallet))
  console.log('  LP staked:   ', formatEther(lpStaked))

  if (lpWallet === 0n) {
    console.log('\n⚠️  No LP tokens in wallet. Minting via Tenderly setBalance...')
    // Tenderly: send ETH to self to confirm connectivity; LP must be obtained via swap/add liquidity
    console.log('   Please add DOLA+fxUSD LP tokens to the wallet first (via Tenderly UI or swap).')
    process.exit(0)
  }

  // ── Step 1: earn position before ──
  const posBefore = await sdk.getEarnPosition({ userAddress, gaugeAddress: GAUGE })
  console.log('\n[Earn Position Before]')
  console.log('  stakedBalance:', formatEther(posBefore.stakedBalance))
  console.log('  pendingFxn:   ', formatEther(posBefore.pendingFxn))

  // ── Step 2: deposit all LP ──
  const depositAmount = lpWallet
  console.log(`\nDepositing ${formatEther(depositAmount)} LP tokens into gauge...`)
  const depositResult = await sdk.earnDeposit({
    userAddress,
    gaugeAddress:   GAUGE,
    lpTokenAddress: LP_TOKEN,
    amount:         depositAmount,
  })
  await sendTxs(depositResult.txs, walletClient, publicClient, 'Deposit LP')

  // ── Step 3: check position after deposit ──
  const posAfterDeposit = await sdk.getEarnPosition({ userAddress, gaugeAddress: GAUGE })
  console.log('\n[After Deposit]')
  console.log('  stakedBalance:', formatEther(posAfterDeposit.stakedBalance))
  console.log('  pendingFxn:   ', formatEther(posAfterDeposit.pendingFxn))

  // ── Step 4: claim FXN rewards ──
  console.log('\nClaiming FXN rewards...')
  const claimFxnResult = await sdk.claimFxn({ userAddress, gaugeAddress: GAUGE })
  if (claimFxnResult.txs.length > 0) {
    await sendTxs(claimFxnResult.txs, walletClient, publicClient, 'Claim FXN')
  } else {
    console.log('  (no FXN rewards to claim)')
  }

  // ── Step 5: claim extra rewards ──
  console.log('\nClaiming extra rewards...')
  const claimRewardsResult = await sdk.claimRewards({ userAddress, gaugeAddress: GAUGE })
  if (claimRewardsResult.txs.length > 0) {
    await sendTxs(claimRewardsResult.txs, walletClient, publicClient, 'Claim Rewards')
  } else {
    console.log('  (no extra rewards to claim)')
  }

  // ── Step 6: partial withdraw (50%) ──
  const posForWithdraw = await sdk.getEarnPosition({ userAddress, gaugeAddress: GAUGE })
  const withdrawAmount = posForWithdraw.stakedBalance / 2n
  console.log(`\nWithdrawing 50% = ${formatEther(withdrawAmount)} LP tokens...`)
  const withdrawResult = await sdk.earnWithdraw({ userAddress, gaugeAddress: GAUGE, amount: withdrawAmount })
  await sendTxs(withdrawResult.txs, walletClient, publicClient, 'Withdraw 50%')

  // ── Step 7: final state ──
  const [lpFinal, lpStakedFinal] = await Promise.all([
    publicClient.readContract({ address: LP_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }) as Promise<bigint>,
    publicClient.readContract({ address: GAUGE,    abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }) as Promise<bigint>,
  ])
  console.log('\n[Final State]')
  console.log('  LP in wallet:', formatEther(lpFinal))
  console.log('  LP staked:   ', formatEther(lpStakedFinal))
  console.log('\n✅ Done')
}

main().catch(e => { console.error(e.message); process.exit(1) })
