import axios from 'axios'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { encodeFunctionData, isAddress } from 'viem'
import SharedLiquidityGaugeAbi from '@/abis/SharedLiquidityGauge.json'
import FXNTokenMinterAbi from '@/abis/FXNTokenMinter.json'
import GaugeControllerAbi from '@/abis/GaugeController.json'
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
  GaugeBaseInfo,
  GaugeDetailedInfo,
  GetGaugeApyRequest,
  GetGaugeApyResult,
} from '@/types'

// Constants for time calculations
const SECONDS_PER_WEEK = BigInt(7 * 24 * 60 * 60)
const SECONDS_PER_YEAR = BigInt(365 * 24 * 60 * 60)
const PRECISION = 1000000000000000000n // 1e18 in BigInt

const GAUGE_LIST_API = 'https://api.aladdin.club/api1/get_fx_gauge_list'
const CONVEX_API = 'https://api.aladdin.club/api1/lp/convex'

/**
 * Fetch the set of LP addresses that are direct gauges (no CRV/CVX rewards).
 * Returns a Set of lowercase LP addresses.
 */
export async function getDirectGaugeSet(): Promise<Set<string>> {
  try {
    const response = await axios.get(GAUGE_LIST_API, { timeout: 10000 })
    const data = response.data?.data
    if (!data) {
      return new Set()
    }

    const directGauges = new Set<string>()
    for (const gauge of Object.values(data)) {
      if ((gauge as any).isDirectGaugeStakeOnly === true && (gauge as any).lpAddress) {
        directGauges.add((gauge as any).lpAddress.toLowerCase())
      }
    }
    return directGauges
  } catch (error) {
    console.warn('⚠️  Failed to fetch direct gauge set:', error instanceof Error ? error.message : error)
    return new Set()
  }
}

/**
 * Fetch Convex extra reward APY for all LP pools.
 * Returns a map of LP address (lowercase) to extra APY percentage.
 *
 * Note:
 * - For direct gauges (isDirectGaugeStakeOnly): only baseApy
 * - For normal gauges: baseApy + crvApy1 + cvxApy
 * - Uses currentApys to check if rewards are currently being distributed
 */
export async function getConvexExtraApy(): Promise<Record<string, number>> {
  try {
    // Get direct gauge set (to identify pools without CRV/CVX rewards)
    const directGaugeSet = await getDirectGaugeSet()

    const response = await axios.get(CONVEX_API, { timeout: 10000 })
    const data = response.data?.data

    // Validate data format
    if (!Array.isArray(data)) {
      console.warn('⚠️  Convex API returned non-array data')
      return {}
    }

    const convexApys: Record<string, number> = {}
    for (const pool of data) {
      // Validate pool object exists
      if (!pool || typeof pool !== 'object') continue

      // Validate required fields
      const address = pool.address
      if (!address || typeof address !== 'string') continue

      // Validate address format
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        console.warn(`⚠️  Invalid LP address format: ${address}`)
        continue
      }

      // Check if direct gauge (no CRV/CVX rewards)
      const isDirectGauge = directGaugeSet.has(address.toLowerCase())

      const currentApys = pool.currentApys
      const curveApys = pool.curveApys

      let extraApy = 0

      if (isDirectGauge) {
        // Direct gauge: only baseApy (trading fees etc), no CRV/CVX
        if (curveApys && typeof curveApys === 'object') {
          const baseApy = Number(curveApys.baseApy || 0)
          if (isNaN(baseApy) || !isFinite(baseApy)) {
            continue
          }
          extraApy = baseApy
        }
      } else {
        // Normal gauge: baseApy + crvApy + cvxApy
        if (currentApys && typeof currentApys === 'object') {
          const baseApy = Number(currentApys.baseApy || 0)
          let crvApy = Number(currentApys.crvApy || 0)
          let cvxApy = Number(currentApys.cvxApy || 0)

          // If currentApys values are 0 or NaN, rewards are not currently distributed
          if (crvApy === 0 || isNaN(crvApy) || cvxApy === 0 || isNaN(cvxApy)) {
            // No current distribution, only show baseApy
            extraApy = baseApy
          } else {
            // Currently distributing, use full APY
            extraApy = baseApy + crvApy + cvxApy
          }
        } else if (curveApys && typeof curveApys === 'object') {
          // Fallback to curveApys
          const baseApy = Number(curveApys.baseApy || 0)
          extraApy = baseApy
        }
      }

      // Validate APY value
      if (isNaN(extraApy) || !isFinite(extraApy)) {
        console.warn(`⚠️  Invalid APY value for ${address}`)
        continue
      }

      // Filter outliers (negative or too large)
      if (extraApy < 0 || extraApy > 1000) {
        console.warn(`⚠️  APY out of reasonable range for ${address}: ${extraApy}%`)
        continue
      }

      // Only save pools with APY
      if (extraApy > 0) {
        convexApys[address.toLowerCase()] = extraApy
      }
    }
    return convexApys
  } catch (error) {
    console.warn('⚠️  Failed to fetch Convex APY:', error instanceof Error ? error.message : error)
    return {}
  }
}

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

  // Use multicall to fetch all basic position info and FXN rewards at once
  // Follow official code order: claimHistorical MUST be called before integrate_fraction
  const results = await client.multicall({
    contracts: [
      // 1. claimHistorical - MUST be called before integrate_fraction to update user rewards
      {
        address: gaugeAddress as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'claimHistorical',
        args: [userAddress as `0x${string}`, []],
      },
      // 2. Get staked balance
      {
        address: gaugeAddress as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      },
      // 3. Get claimed FXN amount (minted from TokenMinter)
      {
        address: contracts.FXN_TokenMinter as `0x${string}`,
        abi: FXNTokenMinterAbi,
        functionName: 'minted',
        args: [userAddress as `0x${string}`, gaugeAddress as `0x${string}`],
      },
      // 4. Get cumulative rewards (integrate_fraction) - MUST be called after claimHistorical
      {
        address: gaugeAddress as `0x${string}`,
        abi: SharedLiquidityGaugeAbi,
        functionName: 'integrate_fraction',
        args: [userAddress as `0x${string}`],
      },
    ],
    allowFailure: true,
  })

  const stakedBalance = results[1].result as bigint
  const minted = results[2].result as bigint
  const integrateFraction = results[3].result as bigint

  // Pending FXN = integrate_fraction - minted
  const pendingFxn = integrateFraction - minted

  // Get extra reward tokens
  const pendingRewards: Record<string, bigint> = {}
  try {
    // Get active reward tokens list
    const rewardTokens = await client.readContract({
      address: gaugeAddress as `0x${string}`,
      abi: SharedLiquidityGaugeAbi,
      functionName: 'getActiveRewardTokens',
    }) as string[]

    // Validate return value is array
    if (!Array.isArray(rewardTokens)) {
      console.warn('getActiveRewardTokens returned non-array result')
      return { stakedBalance, pendingFxn, pendingRewards }
    }

    if (rewardTokens.length > 0) {
      // Use multicall to fetch all claimable rewards at once
      const claimableCalls = rewardTokens
        .filter((tokenAddress) => isAddress(tokenAddress))
        .map((tokenAddress) => ({
          address: gaugeAddress as `0x${string}`,
          abi: SharedLiquidityGaugeAbi,
          functionName: 'claimable' as const,
          args: [userAddress as `0x${string}`, tokenAddress as `0x${string}`],
        }))

      const claimableResults = await client.multicall({
        contracts: claimableCalls,
        allowFailure: true,
      })

      // Process results
      for (let i = 0; i < rewardTokens.length; i++) {
        const tokenAddress = rewardTokens[i]
        if (!isAddress(tokenAddress)) {
          console.warn(`Invalid reward token address: ${tokenAddress}`)
          continue
        }

        const result = claimableResults[i]
        if (result.status === 'success' && result.result && result.result > 0n) {
          pendingRewards[tokenAddress] = result.result as bigint
        } else if (result.status === 'failure') {
          console.warn(
            `Failed to fetch claimable for token ${tokenAddress}:`,
            result.error?.message || 'Unknown error'
          )
        }
      }
    }
  } catch (error) {
    // If fetching extra rewards fails, pendingRewards stays empty object
    console.warn(
      'Failed to fetch extra rewards:',
      error instanceof Error ? error.message : error
    )
  }

  return {
    stakedBalance,
    pendingFxn,
    pendingRewards,
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

/**
 * Fetch comprehensive gauge base information from GaugeController.
 * Returns FXN rate, gauge weights, type weights, and detailed gauge list.
 */
export async function getGaugeBaseInfo(
  gaugeList: GaugeInfo[]
): Promise<GaugeBaseInfo> {
  const client = getClient()

  // Fetch global GaugeController data
  const [total_weight, n_gauge_types, FXNRate] = await Promise.all([
    client.readContract({
      address: contracts.GaugeController as `0x${string}`,
      abi: GaugeControllerAbi,
      functionName: 'get_total_weight',
    }) as Promise<bigint>,
    client.readContract({
      address: contracts.GaugeController as `0x${string}`,
      abi: GaugeControllerAbi,
      functionName: 'n_gauge_types',
    }) as Promise<bigint>,
    client.readContract({
      address: contracts.FXN_Token as `0x${string}`,
      abi: [{ name: 'rate', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
      functionName: 'rate',
    }) as Promise<bigint>,
  ])

  const nGaugeTypes = Number(n_gauge_types)

  // Fetch type weights for all gauge types
  const typeWeightCalls = Array.from({ length: nGaugeTypes }, (_, i) => [
    client.readContract({
      address: contracts.GaugeController as `0x${string}`,
      abi: GaugeControllerAbi,
      functionName: 'get_type_weight',
      args: [i],
    }) as Promise<bigint>,
    client.readContract({
      address: contracts.GaugeController as `0x${string}`,
      abi: GaugeControllerAbi,
      functionName: 'get_weights_sum_per_type',
      args: [i],
    }) as Promise<bigint>,
  ]).flat()

  const typeWeightResults = await Promise.all(typeWeightCalls)
  const typesWeightDatas = Array.from({ length: nGaugeTypes }, (_, i) => ({
    type_weight: typeWeightResults[i * 2],
    weights_sum_per_type: typeWeightResults[i * 2 + 1],
  }))

  // Fetch detailed gauge information
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const nextWeekTimestamp = currentTimestamp + Number(SECONDS_PER_WEEK)

  const gaugeDetailedInfoPromises = gaugeList.map(async (gauge) => {
    try {
      const [gauge_weight, this_week_gauge_weight, next_week_gauge_weight] = await Promise.all([
        client.readContract({
          address: contracts.GaugeController as `0x${string}`,
          abi: GaugeControllerAbi,
          functionName: 'get_gauge_weight',
          args: [gauge.gauge as `0x${string}`],
        }) as Promise<bigint>,
        client.readContract({
          address: contracts.GaugeController as `0x${string}`,
          abi: GaugeControllerAbi,
          functionName: 'gauge_relative_weight',
          args: [gauge.gauge as `0x${string}`, BigInt(currentTimestamp)],
        }) as Promise<bigint>,
        client.readContract({
          address: contracts.GaugeController as `0x${string}`,
          abi: GaugeControllerAbi,
          functionName: 'gauge_relative_weight',
          args: [gauge.gauge as `0x${string}`, BigInt(nextWeekTimestamp)],
        }) as Promise<bigint>,
      ])

      return {
        ...gauge,
        gauge_weight,
        this_week_gauge_weight,
        next_week_gauge_weight,
      }
    } catch (error) {
      throw new Error(`Failed to fetch gauge info for ${gauge.name} (${gauge.gauge}): ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const GaugeList = await Promise.all(gaugeDetailedInfoPromises)

  return {
    total_weight,
    n_gauge_types: nGaugeTypes,
    FXNRate,
    GaugeList,
    typesWeightDatas,
  }
}

/**
 * Calculate base APY for a gauge based on FXN emission, weights, and TVL.
 *
 * **IMPORTANT**: This function calculates the **base APY** without veFXN boost adjustments.
 * The actual APY displayed to users should be adjusted by the application layer using:
 * - `repairBoost`: Pool-level boost correction factor (working_supply / (totalSupply * 40%))
 * - `votingBoost`: User-level boost factor based on veFXN lock (up to 2.5x)
 *
 * Formula:
 * ```
 * // Base FXN rewards per week
 * rewards = (FXNRate * weekSeconds * gaugeWeight * typeWeight) / precision^2
 *
 * // Base APY (without boost)
 * baseApy = (rewards * fxnPrice * weeksPerYear) / (totalSupply * lpPrice) * 100
 *
 * // Total APY = FXN APY + Extra APY (Convex)
 * totalApy = thisWeekApy + convexExtraApy
 *
 * // Application layer should adjust:
 * minDisplayApy = baseApy * repairBoost           // Current boost level
 * maxDisplayApy = baseApy * repairBoost * 2.5     // Max boost (2.5x)
 * ```
 *
 * @param request - APY calculation parameters
 * @returns Base APY for this week and next week, plus total APY including extra rewards
 */
export function getGaugeApy(request: GetGaugeApyRequest): GetGaugeApyResult {
  const { gaugeInfo, lpPrice, fxnPrice, baseInfo, convexExtraApy } = request

  // Validate gaugeType is within bounds
  const gaugeType = gaugeInfo.gaugeType ?? 0
  if (gaugeType < 0 || gaugeType >= baseInfo.n_gauge_types) {
    throw new Error(`gaugeType ${gaugeType} is out of bounds [0, ${baseInfo.n_gauge_types})`)
  }

  const typeWeightData = baseInfo.typesWeightDatas[gaugeType]
  if (!typeWeightData) {
    throw new Error(`Type weight data not found for gaugeType ${gaugeType}`)
  }
  const typeWeight = typeWeightData.type_weight

  // Calculate this week's FXN rewards using incremental division to prevent overflow
  // Formula: FXNRate * weekSeconds * gaugeWeight * typeWeight / precision^2
  // Split into: (((FXNRate * weekSeconds / precision) * gaugeWeight / precision) * typeWeight)
  const thisWeekRewards = (((baseInfo.FXNRate * SECONDS_PER_WEEK) / PRECISION)
    * (gaugeInfo.this_week_gauge_weight ?? 0n) / PRECISION)
    * typeWeight

  // Calculate next week's FXN rewards
  const nextWeekRewards = (((baseInfo.FXNRate * SECONDS_PER_WEEK) / PRECISION)
    * (gaugeInfo.next_week_gauge_weight ?? 0n) / PRECISION)
    * typeWeight

  // Calculate TVL in USD (convert from wei)
  // Use string arithmetic to preserve precision
  const totalSupply = gaugeInfo.totalSupply ?? 0n
  const totalSupplyFloat = Number(totalSupply) / Number(PRECISION)
  const tvlInUsd = totalSupplyFloat * lpPrice

  // Calculate APY as percentage (keep as number to preserve precision)
  let thisWeekApyValue = 0
  let nextWeekApyValue = 0

  if (tvlInUsd > 0 && fxnPrice > 0) {
    const thisWeekRewardsFloat = Number(thisWeekRewards) / Number(PRECISION)
    const nextWeekRewardsFloat = Number(nextWeekRewards) / Number(PRECISION)

    const weeksPerYear = Number(SECONDS_PER_YEAR) / Number(SECONDS_PER_WEEK)

    thisWeekApyValue = (thisWeekRewardsFloat * fxnPrice * weeksPerYear) / tvlInUsd * 100
    nextWeekApyValue = (nextWeekRewardsFloat * fxnPrice * weeksPerYear) / tvlInUsd * 100
  }

  // Add convex extra APY (using number arithmetic to avoid precision issues)
  const extraApyValue = convexExtraApy ?? 0
  const totalApyValue = thisWeekApyValue + extraApyValue

  // Convert to string only at the end (final step)
  const thisWeekApy = thisWeekApyValue.toFixed(2)
  const nextWeekApy = nextWeekApyValue.toFixed(2)
  // Only show extraApy when convexExtraApy is explicitly passed (including 0)
  const extraApy = convexExtraApy !== undefined ? extraApyValue.toFixed(2) : undefined
  const totalApy = totalApyValue.toFixed(2)

  return {
    thisWeekApy,
    nextWeekApy,
    extraApy,
    totalApy,
  }
}
