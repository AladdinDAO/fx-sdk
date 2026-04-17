/**
 * Check user detailed rewards for ETH+FXN pool
 *
 * Usage:
 *   npx tsx scripts/check-user-detailed-rewards.ts <user_address>
 *
 * Example:
 *   npx tsx scripts/check-user-detailed-rewards.ts 0x1234567890123456789012345678901234567890
 */

import { FxSdk } from '../src'
import { getClient } from '../src/core/client'
import SharedLiquidityGaugeAbi from '../src/abis/SharedLiquidityGauge.json'
import FXNTokenMinterAbi from '../src/abis/FXNTokenMinter.json'

// Get user address from command line argument or use test address
const USER_ADDRESS = process.argv[2] || '0x1234567890123456789012345678901234567890'

if (!/^0x[0-9a-fA-F]{40}$/.test(USER_ADDRESS)) {
  console.error('❌ Invalid Ethereum address format')
  console.error('Usage: npx tsx scripts/check-user-detailed-rewards.ts <user_address>')
  console.error('Example: npx tsx scripts/check-user-detailed-rewards.ts 0x1234567890123456789012345678901234567890')
  process.exit(1)
}

async function main() {
  const sdk = new FxSdk()
  const client = getClient()

  console.log('📊 Checking user detailed rewards for ETH+FXN...\n')
  console.log(`User Address: ${USER_ADDRESS}\n`)

  try {
    // 1. Get gauge info
    console.log('🔍 Step 1: Getting ETH+FXN gauge info...')
    const { gauges } = await sdk.getGaugeList()
    const ethFxnGauge = gauges.find(g =>
      g.name?.includes('ETH+FXN') ||
      g.lpAddress?.toLowerCase() === '0xe06a65e09ae18096b99770a809ba175fa05960e2'
    )

    if (!ethFxnGauge) {
      console.log('❌ ETH+FXN gauge not found')
      return
    }

    console.log(`✅ Gauge: ${ethFxnGauge.gauge}`)
    console.log(`✅ LP Token: ${ethFxnGauge.lpAddress}\n`)

    // 2. Get basic position info
    console.log('💰 Step 2: Getting basic position info...')
    const [stakedBalance, integrateFraction, minted] = await Promise.all([
      client.readContract({
        address: ethFxnGauge.gauge as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'balanceOf',
        args: [USER_ADDRESS as `0x${string}`],
      }),
      client.readContract({
        address: ethFxnGauge.gauge as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'integrate_fraction',
        args: [USER_ADDRESS as `0x${string}`],
      }),
      client.readContract({
        address: '0xC8b194925D55d5dE9555AD1db74c149329F71DeF' as `0x${string}`,
        abi: FXNTokenMinterAbi,
        functionName: 'minted',
        args: [USER_ADDRESS as `0x${string}`, ethFxnGauge.gauge as `0x${string}`],
      }),
    ])

    const pendingFxn = integrateFraction - minted

    console.log(`   Staked Balance: ${(Number(stakedBalance) / 1e18).toFixed(4)} LP`)
    console.log(`   Total Earned (integrate_fraction): ${(Number(integrateFraction) / 1e18).toFixed(4)} FXN`)
    console.log(`   Already Claimed (minted): ${(Number(minted) / 1e18).toFixed(4)} FXN`)
    console.log(`   Pending to Claim: ${(Number(pendingFxn) / 1e18).toFixed(4)} FXN\n`)

    // 3. Get extra reward tokens
    console.log('🎁 Step 3: Getting extra reward tokens info...')
    try {
      const rewardTokens = await client.readContract({
        address: ethFxnGauge.gauge as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'getActiveRewardTokens',
      })

      console.log(`   Active reward tokens: ${rewardTokens.length}\n`)

      for (let i = 0; i < (rewardTokens as string[]).length; i++) {
        const tokenAddress = rewardTokens[i] as string
        console.log(`   📎 Reward Token ${i + 1}: ${tokenAddress}`)

        try {
          // Get pending amount
          const pendingReward = await client.readContract({
            address: ethFxnGauge.gauge as `0x${string}`,
            abi: SharedLiquidityGaugeAbi,
            functionName: 'claimable',
            args: [USER_ADDRESS as `0x${string}`, tokenAddress as `0x${string}`],
          })

          const pendingFloat = Number(pendingReward as bigint) / 1e18
          console.log(`      Pending Amount: ${pendingFloat.toFixed(6)} tokens`)

          // Get reward data (distribution rate)
          const rewardData = await client.readContract({
            address: ethFxnGauge.gauge as `0x${string}`,
            abi: SharedLiquidityGaugeAbi,
            functionName: 'rewardData',
            args: [tokenAddress as `0x${string}`],
          })

          const rate = rewardData[1] as bigint // rate
          const ratePerWeek = (Number(rate) / 1e18) * 7 * 24 * 60 * 60

          console.log(`      Distribution Rate: ${ratePerWeek.toFixed(4)} tokens/week`)
        } catch (err) {
          if (err instanceof Error) {
            console.log(`      ❌ Cannot get token info: ${err.message}`)
          } else {
            console.log(`      ❌ Cannot get token info`)
          }
        }
        console.log('')
      }
    } catch (err) {
      if (err instanceof Error) {
        console.log(`   ❌ No extra reward tokens: ${err.message}`)
      } else {
        console.log('   ❌ No extra reward tokens')
      }
    }

    console.log('✅ Done!')
  } catch (err) {
    if (err instanceof Error) {
      console.error('❌ Error:', err.message)
    } else {
      console.error('❌ Error:', err)
    }
  }
}

main().catch(console.error)
