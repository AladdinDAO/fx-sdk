import { FxSdk, tokens } from '../src'
import { privateKeyToAccount } from 'viem/accounts'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
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
    // Example: Repay debt and withdraw collateral
    // Replace with your actual position ID
    const positionId = process.env.POSITION_ID ? parseInt(process.env.POSITION_ID) : 708

    const market: 'ETH' | 'BTC' = 'BTC'
    const withdrawTokenAddress = tokens.WBTC
    const repayAmount = parseEther('10000') // 10,000 fxUSD
    const withdrawAmount = BigInt(0.5 * 1e8) // 0.5 WBTC

    // 1) Preview withdrawable range and isClose flag
    const range = await sdk.getFxMintWithdrawableRange({
      market,
      positionId,
      userAddress,
      repayAmount,
      withdrawTokenAddress,
    })
    console.log('\nWithdrawable range (wei in withdraw token decimals):')
    console.log(`  min: ${range.minWithdraw.toString()}`)
    console.log(`  max: ${range.maxWithdraw.toString()}`)
    console.log(`  isClose: ${range.isClose}`)

    // 2) Build transactions + preview metrics
    const result = await sdk.repayAndWithdraw({
      market,
      positionId,
      repayAmount,
      withdrawAmount,
      withdrawTokenAddress,
      userAddress,
      targets: [ROUTE_TYPES.FX_ROUTE, ROUTE_TYPES.FX_ROUTE_V3],
    })

    console.log('\nPreview:')
    console.log(`  Position ID: ${result.positionId}`)
    console.log(`  Leverage: ${result.leverage.toFixed(2)}x`)
    console.log(`  Execution Price: ${result.executionPrice}`)
    console.log(`  LTV: ${(result.ltv * 100).toFixed(2)}% → ${(result.newLtv * 100).toFixed(2)}%`)
    console.log(`  Fee: ${result.fee.toString()} fxUSD wei (rate ${(result.feeRatio * 100).toFixed(4)}%)`)
    console.log(`  Pay Amount: ${result.payAmount.toString()} fxUSD wei`)
    console.log(`  Collateral: ${result.colls.toString()}`)
    console.log(`  Debt: ${result.debts.toString()}`)
    console.log(`  isClose: ${result.isClose}, isZapOut: ${result.isZapOut}, minOut: ${result.minOut.toString()}`)
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

    console.log(`\n✅ Successfully repaid and withdrew!`)
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
repayAndWithdraw()

