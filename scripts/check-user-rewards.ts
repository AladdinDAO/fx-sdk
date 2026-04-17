import { FxSdk } from '../src'
import { getClient } from '../src/core/client'
import SharedLiquidityGaugeAbi from '../src/abis/SharedLiquidityGauge.json'

const USER_ADDRESS = '0xf3e0974A5fEcFE4173e454993406243B2188EeeD'

async function main() {
  const sdk = new FxSdk()
  const client = getClient()

  console.log('📊 Checking user ETH+FXN rewards...\n')
  console.log(`User Address: ${USER_ADDRESS}\n`)

  try {
    // 1. Get gauge list
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

    console.log(`✅ Found ETH+FXN gauge:`)
    console.log(`   Gauge: ${ethFxnGauge.gauge}`)
    console.log(`   LP: ${ethFxnGauge.lpAddress}\n`)

    // 2. Get user position
    console.log('💰 Step 2: Getting user position and rewards...')
    const position = await sdk.getEarnPosition({
      userAddress: USER_ADDRESS,
      gaugeAddress: ethFxnGauge.gauge
    })

    console.log('\n📊 User Position:')
    console.log(`   Staked Balance: ${position.stakedBalance} LP`)
    console.log(`   Pending FXN: ${position.pendingFxn} FXN`)

    // Show extra rewards
    const rewardCount = Object.keys(position.pendingRewards).length
    if (rewardCount > 0) {
      console.log(`   Pending Rewards (${rewardCount} types):`)
      for (const [tokenAddress, amount] of Object.entries(position.pendingRewards)) {
        const amountFloat = Number(amount) / 1e18
        console.log(`      ${tokenAddress}: ${amountFloat.toFixed(4)} tokens`)
      }
    } else {
      console.log(`   Pending Rewards: No pending rewards`)
    }
    console.log('')

    // 3. Get extra reward info
    console.log('🎁 Step 3: Getting extra reward tokens...')
    try {
      const rewardTokens = await client.readContract({
        address: ethFxnGauge.gauge as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'getActiveRewardTokens',
      }) as string[]

      if (rewardTokens && rewardTokens.length > 0) {
        console.log(`   Active reward tokens: ${rewardTokens.length}`)

        for (const tokenAddress of rewardTokens) {
          try {
            const pendingReward = await client.readContract({
              address: ethFxnGauge.gauge as `0x${string}`,
              abi: SharedLiquidityGaugeAbi,
              functionName: 'claimable',
              args: [USER_ADDRESS as `0x${string}`, tokenAddress as `0x${string}`],
            }) as bigint

            if (pendingReward > 0n) {
              console.log(`   ${tokenAddress}: ${pendingReward} tokens`)
            }
          } catch (err) {
            // Skip tokens that cannot be fetched
          }
        }
      } else {
        console.log('   No extra reward tokens')
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`   No extra reward tokens: ${error.message}`)
      } else {
        console.log('   No extra reward tokens')
      }
    }

    console.log('\n✅ Done!')
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error)
