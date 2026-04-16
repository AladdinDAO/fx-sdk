/**
 * Earn Base APY Calculation Example
 *
 * This example demonstrates how to:
 * 1. Fetch the list of available gauges
 * 2. Get comprehensive gauge base information (weights, rates)
 * 3. Calculate base APY for a specific gauge
 * 4. Fetch real-time prices from API
 *
 * **IMPORTANT**: This calculates the **base APY** without veFXN boost adjustments.
 * The actual APY displayed to users should be adjusted by the application layer.
 *
 * **Price Data Sources**:
 * - LP Prices: https://api.aladdin.club/api1/lp/price
 * - FXN Price: https://api.aladdin.club/api/coingecko/price (fallback $10.0)
 *
 * Base APY Formula:
 * - FXN rewards = (FXNRate * weekSeconds * gaugeWeight * typeWeight) / precision^2
 * - Base APY = (rewards * fxnPrice * weeksPerYear) / (totalSupply * lpPrice) * 100
 *
 * Application Layer Adjustments (not implemented in SDK):
 * - Fetch working_supply and working_balances from gauge contracts
 * - Calculate repairBoost = (totalSupply * 0.4) / working_supply
 * - Calculate user's votingBoost based on veFXN lock (up to 2.5x)
 * - Display: baseApy * repairBoost (current) → baseApy * repairBoost * 2.5 (max)
 *
 * Reference: https://aladdin.club for full boost implementation
 */

import { FxSdk } from '../src'
import { getClient } from '../src/core/client'
import SharedLiquidityGaugeAbi from '../src/abis/SharedLiquidityGauge.json'

// API 配置
const LP_PRICE_API = 'https://api.aladdin.club/api1/lp/price'
const TOKEN_PRICE_API = 'https://api.aladdin.club/api/coingecko/price'

// 获取 LP 价格
async function fetchLpPrices(): Promise<Record<string, number>> {
  try {
    const response = await fetch(LP_PRICE_API)
    const result = await response.json()

    if (result.code === 200 && result.data) {
      const lpPrices: Record<string, number> = {}
      for (const [address, data] of Object.entries(result.data)) {
        const priceData = data as { usd?: string }
        if (priceData.usd) {
          lpPrices[address.toLowerCase()] = parseFloat(priceData.usd)
        }
      }
      return lpPrices
    }
    throw new Error('Failed to fetch LP prices')
  } catch (error) {
    console.error('❌ Error fetching LP prices:', error instanceof Error ? error.message : error)
    return {}
  }
}

// 获取 FXN 价格
async function fetchFxnPrice(): Promise<number> {
  try {
    const response = await fetch(`${TOKEN_PRICE_API}?ids=FXN`)
    const result = await response.json()

    if (result.code === 200 && result.data && result.data.FXN) {
      return result.data.FXN.usd
    }
    throw new Error('FXN price not found')
  } catch (error) {
    console.warn('⚠️  Failed to fetch FXN price from API, using fallback $10.0')
    return 10.0 // fallback 价格
  }
}

async function main() {
  // Initialize SDK
  const sdk = new FxSdk()
  const client = getClient()

  console.log('=== Earn APY Calculation Example ===\n')

  // 1. Fetch real-time prices from API
  console.log('💰 Step 1: Fetching prices from API...')
  const [lpPrices, fxnPrice] = await Promise.all([
    fetchLpPrices(),
    fetchFxnPrice(),
  ])
  console.log(`   ✅ Fetched ${Object.keys(lpPrices).length} LP prices`)
  console.log(`   ✅ FXN Price: $${fxnPrice.toFixed(2)}\n`)

  // 2. Get list of available gauges
  console.log('🔍 Step 2: Fetching gauge list...')
  const gaugeListResult = await sdk.getGaugeList()
  console.log(`   ✅ Found ${gaugeListResult.gauges.length} gauges\n`)

  // 3. Get comprehensive gauge base information
  console.log('⚖️  Step 3: Fetching gauge base information (weights, rates)...')
  const baseInfo = await sdk.getGaugeBaseInfo(gaugeListResult.gauges)
  console.log(`   ✅ FXN Rate: ${baseInfo.FXNRate} per second`)
  console.log(`   ✅ Gauge Types: ${baseInfo.n_gauge_types}`)
  console.log(`   ✅ Total Weight: ${baseInfo.total_weight}\n`)

  // 4. Calculate APY for the first few gauges
  console.log('💰 Step 4: Calculating APY for gauges...\n')

  for (let i = 0; i < Math.min(5, baseInfo.GaugeList.length); i++) {
    const gaugeInfo = baseInfo.GaugeList[i]

    // Get LP price from API (size-insensitive match)
    const lpPrice = lpPrices[gaugeInfo.lpAddress.toLowerCase()] ||
                   lpPrices[gaugeInfo.lpAddress] ||
                   1.0

    // Fetch total supply from gauge contract if not present
    let totalSupply = gaugeInfo.totalSupply || 0n
    if (totalSupply === 0n) {
      try {
        totalSupply = await client.readContract({
          address: gaugeInfo.gauge as `0x${string}`,
          abi: SharedLiquidityGaugeAbi,
          functionName: 'totalSupply',
        }) as bigint
      } catch {
        // Keep as 0 if fetch fails
      }
    }

    // Prepare gauge info with required fields
    const gaugeWithSupply = {
      ...gaugeInfo,
      totalSupply,
      gaugeType: gaugeInfo.gaugeType ?? 0,
    }

    // Calculate APY
    const apyResult = await sdk.getGaugeApy({
      gaugeInfo: gaugeWithSupply,
      lpPrice,
      fxnPrice,
      baseInfo,
    })

    // Calculate TVL
    const tvl = (Number(totalSupply) / 1e18) * lpPrice

    // Display results
    console.log(`📊 ${gaugeInfo.name}`)
    console.log(`   Address:        ${gaugeInfo.gauge}`)
    console.log(`   LP Token:       ${gaugeInfo.lpAddress}`)
    console.log(`   Total Supply:   ${(Number(totalSupply) / 1e18).toFixed(2)} LP`)
    console.log(`   LP Price:       $${lpPrice.toFixed(2)}`)
    console.log(`   TVL:            $${tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
    console.log(`   Gauge Weight:   ${gaugeInfo.gauge_weight?.toString() || 'N/A'}`)
    console.log(`   This Week W:    ${gaugeInfo.this_week_gauge_weight?.toString() || 'N/A'}`)
    console.log(`   Next Week W:    ${gaugeInfo.next_week_gauge_weight?.toString() || 'N/A'}`)
    console.log(`   This Week APY:  ${apyResult.thisWeekApy}%`)
    console.log(`   Next Week APY:  ${apyResult.nextWeekApy}%`)
    console.log('')
  }

  console.log('=== Example Complete ===')
  console.log('')
  console.log('📝 Note: These are base APY values without veFXN boost adjustments.')
  console.log('   For actual user APY, apply repairBoost and votingBoost in your application layer.')
}

// Run the example
main().catch(console.error)
