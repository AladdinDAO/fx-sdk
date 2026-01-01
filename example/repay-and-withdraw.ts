import { FxSdk, tokens } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from example/.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function repayAndWithdraw() {
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
    // Example: Repay debt and withdraw collateral
    // Replace with your actual position ID
    const positionId = process.env.POSITION_ID ? parseInt(process.env.POSITION_ID) : 0

    const result = await sdk.repayAndWithdraw({
      market: 'ETH', // 'ETH' or 'BTC' (only supports long positions)
      positionId,
      repayAmount: parseEther('1000'), // Amount of fxUSD to repay (1000 fxUSD)
      withdrawAmount: parseEther('0.5'), // Amount of collateral to withdraw (0.5 ETH)
      withdrawTokenAddress: tokens.eth, // Withdraw token address (stETH, weth, or wstETH for ETH; WBTC for BTC)
      userAddress,
    })

    console.log('\nTransaction Details:')
    console.log(`  Position ID: ${result.positionId}`)
    console.log(`  Leverage: ${result.leverage.toFixed(2)}x`)
    console.log(`  Execution Price: ${result.executionPrice}`)
    console.log(`  Collateral: ${result.colls.toString()}`)
    console.log(`  Debt: ${result.debts.toString()}`)
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

    console.log(`\n✅ Successfully repaid and withdrew!`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
repayAndWithdraw()

