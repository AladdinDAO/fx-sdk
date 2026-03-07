import { FxSdk } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
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

async function fxsaveDeposit() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in .env file')
  }
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
  const account = privateKeyToAccount(privateKey)
  const userAddress = account.address

  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1
  const chain = getChain(chainId, rpcUrl)
  const sdk = new FxSdk({ rpcUrl, chainId })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  // Example: deposit USDC, fxUSD, or fxUSD Base Pool (use FXSAVE_TOKEN_IN in .env)
  const tokenIn =
    (process.env.FXSAVE_TOKEN_IN as 'usdc' | 'fxUSD' | 'fxUSDBasePool') ||
    'usdc'
  const amountWei = process.env.FXSAVE_AMOUNT_WEI
    ? BigInt(process.env.FXSAVE_AMOUNT_WEI)
    : tokenIn === 'usdc'
      ? parseUnits('10', 6)
      : parseUnits('1', 18)

  console.log(`Deposit ${tokenIn} amount (wei): ${amountWei}`)

  try {
    const result = await sdk.depositFxSave({
      userAddress,
      tokenIn,
      amount: amountWei,
      slippage: 0.5,
    })
    console.log('Transactions to send:', result.txs.length)
    for (let i = 0; i < result.txs.length; i++) {
      const tx = result.txs[i]
      console.log(
        `[${i + 1}/${result.txs.length}] ${tx.type || 'tx'} to ${tx.to}`
      )
      const hash = await walletClient.sendTransaction({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ?? 0n,
        nonce: tx.nonce,
      })
      console.log('  Hash:', hash)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log('  Confirmed in block', receipt.blockNumber)
    }
    console.log('Deposit done.')
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

fxsaveDeposit()
