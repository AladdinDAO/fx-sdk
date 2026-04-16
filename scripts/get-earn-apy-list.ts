/**
 * 获取并显示所有 Earn pools 的基础 APY 列表
 *
 * **注意**: 此脚本显示的是基础 APY，不包括 veFXN boost 修正。
 * 实际应用中，前端应该根据用户的 veFXN 锁定情况调整显示的 APY。
 *
 * **数据来源**:
 * - LP 价格: https://api.aladdin.club/api1/lp/price (实时)
 * - FXN 价格: https://api.aladdin.club/api/coingecko/price (fallback $10.0)
 * - Gauge 数据: 从链上 GaugeController 合约实时获取
 *
 * **Boost 修正逻辑**（应用层实现）:
 * - minApy = baseApy * repairBoost          // 当前 boost 水平
 * - maxApy = baseApy * repairBoost * 2.5    // 最大 boost (2.5x)
 *
 * 参考: https://aladdin.club 获取完整的 boost 实现
 */

import { getGaugeList, getGaugeBaseInfo, getGaugeApy } from '../src/core/earn'
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
      // 转换为小写 key 以便不区分大小写匹配
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
  console.log('📊 Fetching Earn APY List...\n')

  try {
    // 1. 获取价格数据
    console.log('💰 Step 1: Fetching prices from API...')
    const [lpPrices, fxnPrice] = await Promise.all([
      fetchLpPrices(),
      fetchFxnPrice(),
    ])
    console.log(`✅ Fetched ${Object.keys(lpPrices).length} LP prices`)
    console.log(`✅ FXN Price: $${fxnPrice.toFixed(2)}\n`)

    // 2. 获取 gauge 列表
    console.log('🔍 Step 2: Fetching gauge list...')
    const { gauges } = await getGaugeList()
    console.log(`✅ Found ${gauges.length} gauges\n`)

    // 3. 获取 gauge 基础信息（权重、汇率）
    console.log('⚖️  Step 3: Fetching gauge weights and rates...')
    const baseInfo = await getGaugeBaseInfo(gauges)
    console.log(`✅ FXN Rate: ${baseInfo.FXNRate.toString()} per second`)
    console.log(`✅ Gauge Types: ${baseInfo.n_gauge_types}`)
    console.log(`✅ Total Weight: ${baseInfo.total_weight.toString()}\n`)

    // 4. 计算每个 gauge 的 APY
    console.log('💰 Step 4: Calculating APY for each gauge...\n')
    console.log('═'.repeat(80))
    console.log(
      '📈 APY List'.padEnd(50) +
      'This Week APY'.padStart(15) +
      'TVL'.padStart(20)
    )
    console.log('═'.repeat(80))

    const apyList = []
    const client = getClient()

    for (const gaugeInfo of baseInfo.GaugeList) {
      try {
        // 从 API 获取 LP 价格，支持大小写不敏感匹配
        let lpPrice = lpPrices[gaugeInfo.lpAddress.toLowerCase()] ||
                     lpPrices[gaugeInfo.lpAddress] ||
                     1.0

        // 从合约获取实际的总供应量
        let totalSupply = gaugeInfo.totalSupply || 0n
        if (totalSupply === 0n) {
          try {
            totalSupply = await client.readContract({
              address: gaugeInfo.gauge as `0x${string}`,
              abi: SharedLiquidityGaugeAbi,
              functionName: 'totalSupply',
            }) as bigint
          } catch {
            // 如果无法获取，保持为 0
          }
        }

        // 计算 APY
        const apyResult = getGaugeApy({
          gaugeInfo: {
            ...gaugeInfo,
            totalSupply,
            gaugeType: gaugeInfo.gaugeType ?? 0,
          },
          lpPrice,
          fxnPrice,
          baseInfo,
        })

        // 计算 TVL
        const tvl = (Number(totalSupply) / 1e18) * lpPrice

        // 格式化输出
        const name = gaugeInfo.name || 'Unknown'
        const thisWeekApy = parseFloat(apyResult.thisWeekApy)
        const nextWeekApy = parseFloat(apyResult.nextWeekApy)
        const tvlStr = tvl > 0 ? `$${tvl.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'N/A'

        console.log(
          `${name.padEnd(50)}` +
          `${apyResult.thisWeekApy}%`.padStart(15) +
          `TVL: ${tvlStr}`.padStart(20)
        )

        apyList.push({
          name,
          gauge: gaugeInfo.gauge,
          thisWeekApy,
          nextWeekApy,
          tvl,
          lpPrice,
          fxnPrice,
        })
      } catch (error) {
        console.error(
          `❌ Error calculating APY for ${gaugeInfo.name}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    console.log('═'.repeat(80))

    // 4. 统计摘要
    const validApys = apyList.filter((a) => a.thisWeekApy > 0)
    if (validApys.length > 0) {
      const avgApy =
        validApys.reduce((sum, a) => sum + a.thisWeekApy, 0) / validApys.length
      const maxApy = Math.max(...validApys.map((a) => a.thisWeekApy))
      const minApy = Math.min(...validApys.map((a) => a.thisWeekApy))

      console.log('\n📊 Statistics:')
      console.log(`   Total Gauges: ${apyList.length}`)
      console.log(`   Active Gauges: ${validApys.length}`)
      console.log(`   Average APY: ${avgApy.toFixed(2)}%`)
      console.log(`   Highest APY: ${maxApy.toFixed(2)}%`)
      console.log(`   Lowest APY: ${minApy.toFixed(2)}%`)
    }

    console.log('\n✨ Done!\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
