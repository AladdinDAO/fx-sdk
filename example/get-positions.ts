import { FxSdk } from '../src'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from example/.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function getPositions() {
  // Initialize SDK
  const rpcUrl = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com'
  const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1

  const sdk = new FxSdk({
    rpcUrl,
    chainId,
  })

  // Get wallet address from private key if available
  let userAddress = process.env.USER_ADDRESS

  if (!userAddress && process.env.PRIVATE_KEY) {
    const { privateKeyToAccount } = await import('viem/accounts')
    const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
      ? (process.env.PRIVATE_KEY as `0x${string}`)
      : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
    const account = privateKeyToAccount(privateKey)
    userAddress = account.address
  }

  if (!userAddress) {
    throw new Error('Either USER_ADDRESS or PRIVATE_KEY must be set in .env file')
  }

  console.log(`Querying positions for: ${userAddress}\n`)

  try {
    // Get positions for ETH long
    console.log('=== ETH Long Positions ===')
    const ethLongPositions = await sdk.getPositions({
      userAddress,
      market: 'ETH',
      type: 'long',
    })

    if (ethLongPositions.length === 0) {
      console.log('No positions found\n')
    } else {
      ethLongPositions.forEach((position, index) => {
        console.log(`Position ${index + 1}:`)
        console.log(`  Raw Collateral: ${position.rawColls.toString()}`)
        console.log(`  Raw Debt: ${position.rawDebts.toString()}`)
        console.log(`  Current Leverage: ${position.currentLeverage.toFixed(2)}x`)
        console.log(`  LSD Leverage: ${position.lsdLeverage.toFixed(2)}x`)
        console.log('')
      })
    }

    // Get positions for ETH short
    console.log('=== ETH Short Positions ===')
    const ethShortPositions = await sdk.getPositions({
      userAddress,
      market: 'ETH',
      type: 'short',
    })

    if (ethShortPositions.length === 0) {
      console.log('No positions found\n')
    } else {
      ethShortPositions.forEach((position, index) => {
        console.log(`Position ${index + 1}:`)
        console.log(`  Raw Collateral: ${position.rawColls.toString()}`)
        console.log(`  Raw Debt: ${position.rawDebts.toString()}`)
        console.log(`  Current Leverage: ${position.currentLeverage.toFixed(2)}x`)
        console.log(`  LSD Leverage: ${position.lsdLeverage.toFixed(2)}x`)
        console.log('')
      })
    }

    // Get positions for BTC long
    console.log('=== BTC Long Positions ===')
    const btcLongPositions = await sdk.getPositions({
      userAddress,
      market: 'BTC',
      type: 'long',
    })

    if (btcLongPositions.length === 0) {
      console.log('No positions found\n')
    } else {
      btcLongPositions.forEach((position, index) => {
        console.log(`Position ${index + 1}:`)
        console.log(`  Raw Collateral: ${position.rawColls.toString()}`)
        console.log(`  Raw Debt: ${position.rawDebts.toString()}`)
        console.log(`  Current Leverage: ${position.currentLeverage.toFixed(2)}x`)
        console.log(`  LSD Leverage: ${position.lsdLeverage.toFixed(2)}x`)
        console.log('')
      })
    }

    // Get positions for BTC short
    console.log('=== BTC Short Positions ===')
    const btcShortPositions = await sdk.getPositions({
      userAddress,
      market: 'BTC',
      type: 'short',
    })

    if (btcShortPositions.length === 0) {
      console.log('No positions found\n')
    } else {
      btcShortPositions.forEach((position, index) => {
        console.log(`Position ${index + 1}:`)
        console.log(`  Raw Collateral: ${position.rawColls.toString()}`)
        console.log(`  Raw Debt: ${position.rawDebts.toString()}`)
        console.log(`  Current Leverage: ${position.currentLeverage.toFixed(2)}x`)
        console.log(`  LSD Leverage: ${position.lsdLeverage.toFixed(2)}x`)
        console.log('')
      })
    }
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
getPositions()

