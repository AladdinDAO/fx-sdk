import { FxSdk, tokens } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { ROUTE_TYPES } from '../src/core/aggregators'

// Load environment variables from example/.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function increasePosition() {
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
  const rpcUrl = process.env.RPC_URL || 'https://eth.llamarpc.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  const sdk = new FxSdk({
    rpcUrl,
    chainId,
  })

  // Create wallet client for sending transactions
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(rpcUrl),
  })

  // Create public client for waiting transaction receipts
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  })

  try {
    // Example: Open a new position or add to existing position
    const result = await sdk.increasePosition({
      market: 'ETH', // 'ETH' or 'BTC'
      type: 'long',  // 'long' or 'short'
      positionId: 0, // 0 means open new position, > 0 means existing position ID
      leverage: 3,   // Leverage multiplier
      inputTokenAddress: tokens.eth, // Input token address
      amount: parseEther('1'), // Input amount (1 ETH)
      slippage: 1,   // Slippage tolerance (1%)
      userAddress,
      targets: [ROUTE_TYPES.FX_ROUTE],
    })

    console.log(`Found ${result.routes.length} route options`)

    if (result.routes.length === 0) {
      console.log('No routes available')
      return
    }

    // Select the first route (usually the best)
    const selectedRoute = result.routes[0]

    console.log('\nSelected Route:')
    console.log(`  Position ID: ${result.positionId}`)
    console.log(`  New Leverage: ${selectedRoute.leverage}`)
    console.log(`  Execution Price: ${selectedRoute.executionPrice}%`)
    console.log(`  Transactions: ${selectedRoute.txs.length}`)

    // Execute transactions sequentially
    for (let i = 0; i < selectedRoute.txs.length; i++) {
      const tx = selectedRoute.txs[i]
      console.log(`\n[${i + 1}/${selectedRoute.txs.length}] Sending transaction: ${tx.type}`)
      console.log(`  From: ${tx.from}`)
      console.log(`  To: ${tx.to}`)
      console.log(`  Nonce: ${tx.nonce}`)

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

    console.log(`\n✅ Successfully executed all transactions!`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
increasePosition()

