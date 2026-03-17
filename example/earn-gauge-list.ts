import { FxSdk } from '../src'

async function earnGaugeList() {
  const sdk = new FxSdk()

  console.log('Fetching Liquidity Gauge list from Aladdin API...\n')

  try {
    const { gauges } = await sdk.getGaugeList()
    console.log(`Found ${gauges.length} Liquidity Gauges:\n`)
    gauges.forEach((g, i) => {
      console.log(`  [${i + 1}] ${g.name}`)
      console.log(`      Gauge:  ${g.gauge}`)
      console.log(`      LP:     ${g.lpAddress}`)
    })
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

earnGaugeList()
