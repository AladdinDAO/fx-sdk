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

async function fxsaveRedeemStatus() {
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

  console.log(`Redeem status for: ${userAddress}\n`)

  try {
    const status = await sdk.getFxSaveRedeemStatus({ userAddress })

    if (!status.hasPendingRedeem) {
      console.log('Withdrawal Process: none')
      console.log('Has pending redeem: false')
      return
    }

    const amountFormatted = Number(status.pendingSharesWei) / 1e18
    const isCanClaim = status.isCooldownComplete
    const redeemableAtStr =
      status.redeemableAt != null
        ? new Date(status.redeemableAt * 1000).toLocaleString()
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
    console.log('')
    console.log('Has pending redeem:', status.hasPendingRedeem)
    console.log('Pending shares (wei):', status.pendingSharesWei.toString())
    console.log(
      'Cooldown period (seconds):',
      status.cooldownPeriodSeconds.toString()
    )
    console.log('Redeemable at:', redeemableAtStr)
    console.log('Redeemable at (timestamp):', status.redeemableAt ?? 'N/A')
    console.log('Is cooldown complete:', status.isCooldownComplete)

    if (status.isCooldownComplete && status.hasPendingRedeem) {
      console.log('\nCooldown complete. Building claim tx (claim(receiver))...')
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
      } else {
        console.log('Claim tx (send with your wallet):', txs[0])
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

fxsaveRedeemStatus()
