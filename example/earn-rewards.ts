/**
 * Earn Rewards Query Example
 *
 * This example demonstrates how to:
 * 1. Query user's position in a gauge (staked balance, pending FXN)
 * 2. Query extra reward tokens (CRV, CVX, etc.) pending for the user
 * 3. Display detailed reward information
 *
 * **Configuration**:
 * You can provide USER_ADDRESS in three ways (priority order):
 * 1. Command line argument: npx tsx example/earn-rewards.ts <address>
 * 2. Environment variable: USER_ADDRESS=0x... npx tsx example/earn-rewards.ts
 * 3. npm script: npm run example:earn-rewards (uses USER_ADDRESS from .env)
 *
 * Usage:
 *   # Method 1: Command line argument
 *   npx tsx example/earn-rewards.ts 0x1234567890123456789012345678901234567890
 *
 *   # Method 2: Environment variable
 *   USER_ADDRESS=0x1234... npx tsx example/earn-rewards.ts
 *
 *   # Method 3: Add to package.json and use .env file
 *   # Add to example/.env: USER_ADDRESS=0x1234...
 *   npm run example:earn-rewards
 */

import { FxSdk } from '../src'
import { isAddress } from 'viem'

// Get user address from multiple sources (priority: CLI arg > env > default)
const USER_ADDRESS = process.argv[2] || process.env.USER_ADDRESS

if (!USER_ADDRESS) {
  console.error('❌ Error: User address is required')
  console.error('')
  console.error('Please provide USER_ADDRESS in one of these ways:')
  console.error('  1. Command line argument:')
  console.error('     npx tsx example/earn-rewards.ts 0x1234567890123456789012345678901234567890')
  console.error('')
  console.error('  2. Environment variable:')
  console.error('     USER_ADDRESS=0x1234... npx tsx example/earn-rewards.ts')
  console.error('')
  console.error('  3. Create example/.env file:')
  console.error('     echo "USER_ADDRESS=0x1234..." > example/.env')
  process.exit(1)
}

if (!isAddress(USER_ADDRESS)) {
  console.error('❌ Error: Invalid Ethereum address format')
  console.error('Please provide a valid 0x-prefixed 42-character hex address')
  process.exit(1)
}

async function main() {
  const sdk = new FxSdk()

  console.log('=== Earn Rewards Query Example ===\n')
  console.log(`User Address: ${USER_ADDRESS}\n`)

  try {
    // 1. Get gauge list and find ETH+FXN gauge
    console.log('🔍 Step 1: Fetching gauge list...')
    const { gauges } = await sdk.getGaugeList()

    const ethFxnGauge = gauges.find(g =>
      g.name?.includes('ETH+FXN') ||
      g.lpAddress?.toLowerCase() === '0xe06a65e09ae18096b99770a809ba175fa05960e2'
    )

    if (!ethFxnGauge) {
      console.log('❌ ETH+FXN gauge not found')
      return
    }

    console.log(`✅ Found ETH+FXN gauge:`)
    console.log(`   Gauge:   ${ethFxnGauge.gauge}`)
    console.log(`   LP Token: ${ethFxnGauge.lpAddress}\n`)

    // 2. Get user position (using multicall for optimal performance)
    console.log('💰 Step 2: Fetching user position and rewards...')
    const position = await sdk.getEarnPosition({
      userAddress: USER_ADDRESS,
      gaugeAddress: ethFxnGauge.gauge
    })

    // Display FXN rewards
    console.log('\n📊 FXN Rewards:')
    console.log(`   Staked Balance:    ${(Number(position.stakedBalance) / 1e18).toFixed(6)} LP`)

    if (position.pendingFxn > 0n) {
      console.log(`   Pending FXN:       ${(Number(position.pendingFxn) / 1e18).toFixed(6)} FXN`)
    } else {
      console.log(`   Pending FXN:       0.00 FXN`)
    }

    // Display extra rewards
    const rewardCount = Object.keys(position.pendingRewards).length
    if (rewardCount > 0) {
      console.log(`\n🎁 Extra Reward Tokens (${rewardCount} types):`)
      for (const [tokenAddress, amount] of Object.entries(position.pendingRewards)) {
        const amountFloat = Number(amount) / 1e18
        const shortAddress = `${tokenAddress.slice(0, 10)}...${tokenAddress.slice(-8)}`
        console.log(`   ${shortAddress}: ${amountFloat.toFixed(6)} tokens`)
      }
    } else {
      console.log(`\n🎁 Extra Reward Tokens: No pending rewards`)
    }

    // 3. Summary
    console.log('\n=== Summary ===')
    const totalPendingFxn = Number(position.pendingFxn) / 1e18
    const totalExtraRewards = Object.values(position.pendingRewards).reduce(
      (sum, amount) => sum + Number(amount) / 1e18,
      0
    )

    if (totalPendingFxn > 0 || totalExtraRewards > 0) {
      console.log(`Total Pending Rewards:`)
      if (totalPendingFxn > 0) {
        console.log(`  FXN:   ${totalPendingFxn.toFixed(6)} FXN`)
      }
      if (totalExtraRewards > 0) {
        console.log(`  Extra: ${totalExtraRewards.toFixed(6)} tokens (${rewardCount} types)`)
      }
      console.log(`\n✅ You have rewards to claim!`)
    } else {
      console.log(`No pending rewards found.`)
      console.log(`\n💡 Tip: Stake your LP tokens to start earning rewards`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the example
main().catch(console.error)
