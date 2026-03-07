/**
 * Query claimable value and perform claim (align with app fxSAVEPage + ClaimModal).
 * - getFxSaveClaimable: redeem status + preview receive (fxUSD + USDC from previewRedeem)
 * - getRedeemTx: build claim(receiver) tx when cooldown complete
 * Run: npm run example:fxsave-claim
 */
import { FxSdk } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
} from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

function getChain(chainId: number, rpcUrl: string) {
  return defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [rpcUrl] } },
  })
}

function formatWei(wei: bigint, decimals: number) {
  const s = wei.toString()
  if (s.length <= decimals) return '0.' + s.padStart(decimals, '0')
  return s.slice(0, -decimals) + '.' + s.slice(-decimals)
}

async function fxsaveClaim() {
  let userAddress = process.env.USER_ADDRESS
  if (!userAddress && process.env.PRIVATE_KEY) {
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

  console.log(`Claimable for: ${userAddress}\n`)

  try {
    const claimable = await sdk.getFxSaveClaimable({ userAddress })

    if (!claimable.hasPendingRedeem) {
      console.log('Withdrawal Process: none')
      console.log('Nothing to claim.')
      return
    }

    const amountFormatted = Number(claimable.pendingSharesWei) / 1e18
    const isCanClaim = claimable.isCooldownComplete
    const redeemableAtStr =
      claimable.redeemableAt != null
        ? new Date(claimable.redeemableAt * 1000).toLocaleString()
        : 'N/A'

    console.log('--- Withdrawal Process (align with fxSAVEPage) ---')
    if (isCanClaim) {
      console.log(
        `${amountFormatted} fxUSD Stability Pool Tokens can be claimed now.`
      )
    } else {
      console.log(
        `${amountFormatted} fxUSD Stability Pool Tokens can be withdrawn after ${redeemableAtStr}`
      )
    }

    if (claimable.previewReceive) {
      const { amountYieldOutWei, amountStableOutWei } = claimable.previewReceive
      console.log(
        '\n--- Preview receive (align with ClaimModal Min Receive) ---'
      )
      console.log(
        `  fxUSD: ${formatWei(amountYieldOutWei, 18)} (wei: ${amountYieldOutWei})`
      )
      console.log(
        `  USDC:  ${formatWei(amountStableOutWei, 6)} (wei: ${amountStableOutWei})`
      )
    }

    console.log('\n--- Status ---')
    console.log('Pending shares (wei):', claimable.pendingSharesWei.toString())
    console.log(
      'Cooldown period (seconds):',
      claimable.cooldownPeriodSeconds.toString()
    )
    console.log('Redeemable at:', redeemableAtStr)
    console.log('Redeemable at (timestamp):', claimable.redeemableAt ?? 'N/A')
    console.log('Is cooldown complete:', claimable.isCooldownComplete)

    if (claimable.isCooldownComplete && claimable.hasPendingRedeem) {
      console.log('\n--- Claim ---')
      console.log('Building claim tx (claim(receiver))...')
      const { txs } = await sdk.getRedeemTx({ userAddress })
      if (process.env.PRIVATE_KEY && txs.length > 0) {
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
          ? (process.env.PRIVATE_KEY as `0x${string}`)
          : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
        const account = privateKeyToAccount(privateKey)
        const chain = getChain(chainId, rpcUrl)
        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(rpcUrl),
        })
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl),
        })
        const tx = txs[0]
        const hash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: tx.value ?? 0n,
          nonce: tx.nonce,
        })
        console.log('Claim tx sent:', hash)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        console.log('Confirmed in block', receipt.blockNumber)
        console.log('Claim done.')
      } else {
        console.log('Claim tx (send with your wallet):', txs[0])
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

fxsaveClaim()
