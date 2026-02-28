import { FxSdk, CHAIN_ID_ETHEREUM, CHAIN_ID_BASE, DEFAULT_RPC_BY_CHAIN } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { mainnet, base } from 'viem/chains'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

const SUPPORTED_CHAIN_IDS = [CHAIN_ID_ETHEREUM, CHAIN_ID_BASE] as const

function getChain(chainId: number) {
  if (chainId === CHAIN_ID_BASE) return base
  if (chainId === CHAIN_ID_ETHEREUM) return mainnet
  throw new Error(`Unsupported CHAIN_ID for bridge: ${chainId}. Use 1 (Ethereum) or 8453 (Base).`)
}

async function layerzeroBridge() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in .env file')
  }

  const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)

  const account = privateKeyToAccount(privateKey)
  const userAddress = account.address

  const sourceChainId = process.env.CHAIN_ID
    ? parseInt(process.env.CHAIN_ID, 10)
    : CHAIN_ID_ETHEREUM
  const destChainId =
    sourceChainId === CHAIN_ID_ETHEREUM ? CHAIN_ID_BASE : CHAIN_ID_ETHEREUM

  if (!SUPPORTED_CHAIN_IDS.includes(sourceChainId as 1 | 8453)) {
    throw new Error(
      `CHAIN_ID must be 1 (Ethereum) or 8453 (Base) for bridge. Got: ${sourceChainId}`
    )
  }

  const rpcUrl =
    process.env.RPC_URL || DEFAULT_RPC_BY_CHAIN[sourceChainId]
  const chain = getChain(sourceChainId)

  console.log(`Using wallet: ${userAddress}`)
  console.log(`Source chain: ${sourceChainId} (${sourceChainId === 8453 ? 'Base' : 'Ethereum'})`)
  console.log(`Destination chain: ${destChainId} (${destChainId === 8453 ? 'Base' : 'Ethereum'})`)

  const sdk = new FxSdk({ rpcUrl, chainId: sourceChainId })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  try {
    const token = 'fxUSD'
    const amount = parseEther('0.1') // 0.1 tokens (18 decimals)
    const recipient = userAddress

    const quoteRequest = {
      sourceChainId: sourceChainId as 1 | 8453,
      destChainId: destChainId as 1 | 8453,
      token,
      amount,
      recipient,
      sourceRpcUrl: rpcUrl,
    }

    const quote = await sdk.getBridgeQuote(quoteRequest)
    console.log('\nBridge quote:')
    console.log(`  Native fee (wei): ${quote.nativeFee}`)
    console.log(`  LZ token fee (wei): ${quote.lzTokenFee}`)

    const result = await sdk.buildBridgeTx({
      ...quoteRequest,
      refundAddress: userAddress,
    })

    const tx = result.tx
    console.log('\nBuilt bridge tx:')
    console.log(`  To: ${tx.to}`)
    console.log(`  Data: ${tx.data}`)
    console.log(`  Value: ${tx.value} wei`)

    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data,
      value: tx.value,
    })

    console.log(`\nTransaction hash: ${hash}`)
    console.log('Waiting for confirmation...')

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`)
    console.log('Bridge initiated. Funds will arrive on destination chain after LayerZero confirmation.')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error:', message)
    process.exit(1)
  }
}

layerzeroBridge()
