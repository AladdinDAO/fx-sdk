import axios from 'axios'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { encodeFunctionData, isAddress } from 'viem'
import SharedLiquidityGaugeAbi from '@/abis/SharedLiquidityGauge.json'
import FXNTokenMinterAbi from '@/abis/FXNTokenMinter.json'
import { getNonce } from '@/utils/service'
import { approveToken } from '@/utils/approve'
import type {
  GaugeInfo,
  GetGaugeListResult,
  GetEarnPositionRequest,
  GetEarnPositionResult,
  EarnDepositRequest,
  EarnDepositResult,
  EarnWithdrawRequest,
  EarnWithdrawResult,
  ClaimFxnRequest,
  ClaimFxnResult,
  ClaimRewardsRequest,
  ClaimRewardsResult,
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

export async function getEarnPosition(
  request: GetEarnPositionRequest
): Promise<GetEarnPositionResult> {
  const { userAddress, gaugeAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(gaugeAddress)) {
    throw new Error('Gauge address must be a valid Ethereum address')
  }

  const client = getClient()

  const [stakedBalance, integrateFraction, minted] = await Promise.all([
    client.readContract({
      address: gaugeAddress as `0x${string}`,
      abi: SharedLiquidityGaugeAbi,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: gaugeAddress as `0x${string}`,
      abi: SharedLiquidityGaugeAbi,
      functionName: 'integrate_fraction',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: contracts.FXN_TokenMinter as `0x${string}`,
      abi: FXNTokenMinterAbi,
      functionName: 'minted',
      args: [userAddress as `0x${string}`, gaugeAddress as `0x${string}`],
    }) as Promise<bigint>,
  ])

  const pendingFxn = integrateFraction - minted

  return {
    stakedBalance,
    pendingFxn,
    pendingRewards: {},
  }
}

export async function earnWithdraw(
  request: EarnWithdrawRequest
): Promise<EarnWithdrawResult> {
  const { userAddress, gaugeAddress, amount } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(gaugeAddress)) {
    throw new Error('Gauge address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [
    {
      type: 'withdraw',
      from: userAddress,
      to: gaugeAddress,
      data: encodeFunctionData({
        abi: SharedLiquidityGaugeAbi,
        functionName: 'withdraw',
        args: [amount, userAddress as `0x${string}`],
      }),
      value: 0n,
      nonce: nonce++,
      chainId,
    },
  ]

  return { txs }
}

export async function claimFxn(
  request: ClaimFxnRequest
): Promise<ClaimFxnResult> {
  const { userAddress, gaugeAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(gaugeAddress)) {
    throw new Error('Gauge address must be a valid Ethereum address')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [
    {
      type: 'claimFxn',
      from: userAddress,
      to: contracts.FXN_TokenMinter,
      data: encodeFunctionData({
        abi: FXNTokenMinterAbi,
        functionName: 'mint',
        args: [gaugeAddress as `0x${string}`],
      }),
      value: 0n,
      nonce: nonce++,
      chainId,
    },
  ]

  return { txs }
}

export async function claimRewards(
  request: ClaimRewardsRequest
): Promise<ClaimRewardsResult> {
  const { userAddress, gaugeAddress, receiver } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(gaugeAddress)) {
    throw new Error('Gauge address must be a valid Ethereum address')
  }
  const actualReceiver = receiver || userAddress
  if (!isAddress(actualReceiver)) {
    throw new Error('Receiver must be a valid Ethereum address')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [
    {
      type: 'claimRewards',
      from: userAddress,
      to: gaugeAddress,
      data: encodeFunctionData({
        abi: SharedLiquidityGaugeAbi,
        functionName: 'claim',
        args: [userAddress as `0x${string}`, actualReceiver as `0x${string}`],
      }),
      value: 0n,
      nonce: nonce++,
      chainId,
    },
  ]

  return { txs }
}
