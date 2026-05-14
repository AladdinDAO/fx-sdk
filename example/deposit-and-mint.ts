import { FxSdk, tokens } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  defineChain,
} from 'viem'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { ROUTE_TYPES } from '../src/core/aggregators'

// Load environment variables from example/.env
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

async function depositAndMint() {
  // Validate environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set in .env file')
  }

  // Initialize wallet from private key
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)

  const account = privateKeyToAccount(privateKey)
  const userAddress = account.address

  console.log(`Using wallet: ${userAddress}`)

  // Initialize SDK
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1
  const chain = getChain(chainId, rpcUrl)

  const sdk = new FxSdk({
    rpcUrl,
    chainId,
  })

  // Create wallet client for sending transactions
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  })

  // Create public client for waiting transaction receipts
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  try {
    // Example: Deposit collateral and mint fxUSD
    // Replace with your actual position ID (0 for new position)
    const positionId = process.env.POSITION_ID ? parseInt(process.env.POSITION_ID) : 0

    const market: 'ETH' | 'BTC' = 'BTC'
    const depositTokenAddress = tokens.WBTC
    const depositAmount = BigInt(1e8) // 1 WBTC
    const mintAmount = parseEther('20000') // 20,000 fxUSD

    // 1) Preview mintable range (parity with Mintable cap on the fxMINT page)
    const range = await sdk.getFxMintMintableRange({
      market,
      positionId,
      userAddress,
      depositTokenAddress,
      depositAmount,
    })
    console.log('\nMintable range (fxUSD wei):')
    console.log(`  min: ${range.minMint.toString()}`)
    console.log(`  max: ${range.maxMint.toString()}`)

    if (mintAmount > range.maxMint || mintAmount < range.minMint) {
      console.warn(`  ⚠️ mintAmount ${mintAmount} outside [${range.minMint}, ${range.maxMint}] — SDK call may revert.`)
    }

    // 2) Build transactions + preview metrics (LTV / leverage / fee)
    const result = await sdk.depositAndMint({
      market,
      positionId,
      depositTokenAddress,
      depositAmount,
      mintAmount,
      userAddress,
      targets: [ROUTE_TYPES.FX_ROUTE],
    })

    console.log('\nPreview:')
    console.log(`  Position ID: ${result.positionId}`)
    console.log(`  Leverage: ${result.leverage.toFixed(2)}x`)
    console.log(`  Execution Price: ${result.executionPrice}`)
    console.log(`  LTV: ${(result.ltv * 100).toFixed(2)}% → ${(result.newLtv * 100).toFixed(2)}%`)
    console.log(`  Fee: ${result.fee.toString()} fxUSD wei (rate ${(result.feeRatio * 100).toFixed(4)}%)`)
    console.log(`  Collateral: ${result.colls.toString()}`)
    console.log(`  Debt: ${result.debts.toString()}`)
    console.log(`  isZapIn: ${result.isZapIn}, minOut: ${result.minOut.toString()}`)
    console.log(`  Transactions: ${result.txs.length}`)

    if (result.txs.length === 0) {
      console.log('No transactions needed')
      return
    }

    // Execute transactions sequentially
    for (let i = 0; i < result.txs.length; i++) {
      const tx = result.txs[i]
      console.log(`\n[${i + 1}/${result.txs.length}] Sending transaction: ${tx.type || 'trade'}`)
      console.log(`  From: ${tx.from}`)
      console.log(`  To: ${tx.to}`)
      console.log(`  Nonce: ${tx.nonce}`)
      console.log(`  Data: ${tx.data}`)
      
      if (tx.value && tx.value > 0n) {
        console.log(`  Value: ${tx.value.toString()} wei`)
      }

      try {
        // Send transaction
        const hash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: tx.value || 0n,
          nonce: tx.nonce,
        })

        console.log(`  Transaction hash: ${hash}`)
        console.log(`  Waiting for confirmation...`)

        // Wait for transaction receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`)
      } catch (error: any) {
        console.error(`  ❌ Transaction failed:`, error.message)
        throw error
      }
    }

    console.log(`\n✅ Successfully deposited and minted!`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
depositAndMint()

