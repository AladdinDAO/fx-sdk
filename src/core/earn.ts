import axios from 'axios'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { encodeFunctionData, isAddress } from 'viem'
import SharedLiquidityGaugeAbi from '@/abis/SharedLiquidityGauge.json'
import { getNonce } from '@/utils/service'
import { approveToken } from '@/utils/approve'
import type {
  GaugeInfo,
  GetGaugeListResult,
  EarnDepositRequest,
  EarnDepositResult,
  FxSaveTx,
} from '@/types'

const GAUGE_LIST_API = 'https://api.aladdin.club/api1/get_fx_gauge_list'

export async function getGaugeList(): Promise<GetGaugeListResult> {
  const response = await axios.get(GAUGE_LIST_API, { timeout: 10000 })
  const data = response.data?.data
  if (!data) {
    throw new Error('Failed to fetch gauge list from Aladdin API')
  }

  const gauges: GaugeInfo[] = Object.values(data)
    .filter((g: any) => g.type === 'Liquidity Gauge')
    .map((g: any) => ({
      name: g.name,
      gauge: g.gauge,
      lpAddress: g.lpAddress,
    }))

  return { gauges }
}

export async function earnDeposit(
  request: EarnDepositRequest
): Promise<EarnDepositResult> {
  const { userAddress, gaugeAddress, lpTokenAddress, amount } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(gaugeAddress)) {
    throw new Error('Gauge address must be a valid Ethereum address')
  }
  if (!isAddress(lpTokenAddress)) {
    throw new Error('LP token address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  const client = getClient()
  const txs: FxSaveTx[] = []
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const approveTx = await approveToken({
    tokenAddress: lpTokenAddress,
    amount,
    spender: gaugeAddress,
    userAddress,
  })
  if (approveTx) {
    txs.push({ ...approveTx, nonce: nonce++, chainId })
  }

  txs.push({
    type: 'deposit',
    from: userAddress,
    to: gaugeAddress,
    data: encodeFunctionData({
      abi: SharedLiquidityGaugeAbi,
      functionName: 'deposit',
      args: [amount, userAddress as `0x${string}`, true],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  })

  return { txs }
}
