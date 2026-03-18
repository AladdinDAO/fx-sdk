import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { encodeFunctionData, isAddress } from 'viem'
import VotingEscrowAbi from '@/abis/VotingEscrow.json'
import FeeDistributorAbi from '@/abis/FeeDistributor.json'
import VotingEscrowBoostAbi from '@/abis/VotingEscrowBoost.json'
import { getNonce } from '@/utils/service'
import { approveToken } from '@/utils/approve'
import type {
  GetLockInfoRequest,
  GetLockInfoResult,
  CreateLockRequest,
  CreateLockResult,
  IncreaseLockAmountRequest,
  IncreaseLockAmountResult,
  ExtendLockTimeRequest,
  ExtendLockTimeResult,
  WithdrawLockRequest,
  WithdrawLockResult,
  ClaimLockRewardsRequest,
  ClaimLockRewardsResult,
  DelegateBoostRequest,
  DelegateBoostResult,
  UndelegateBoostRequest,
  UndelegateBoostResult,
  FxSaveTx,
} from '@/types'

export const WEEK_SECONDS = 604800

const veFXN = contracts.veFXN as `0x${string}`
const feeDistributor = contracts.FeeDistributor as `0x${string}`
const veBoost = contracts.VotingEscrowBoost as `0x${string}`
const fxnToken = contracts.FXN_Token as `0x${string}`

function alignToWeek(timestamp: number): number {
  return Math.floor(timestamp / WEEK_SECONDS) * WEEK_SECONDS
}

export async function getLockInfo(
  request: GetLockInfoRequest
): Promise<GetLockInfoResult> {
  const { userAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()
  const now = Math.floor(Date.now() / 1000)
  const lastThursday = BigInt(alignToWeek(now))

  const [
    lockedData,
    vePower,
    veTotalSupply,
    delegatedBalance,
    delegableBalance,
    adjustedVeBalance,
    weeklyFeeAmount,
  ] = await Promise.all([
    client.readContract({
      address: veFXN,
      abi: VotingEscrowAbi,
      functionName: 'locked',
      args: [userAddress as `0x${string}`],
    }) as Promise<{ amount: bigint; end: bigint }>,
    client.readContract({
      address: veFXN,
      abi: VotingEscrowAbi,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: veFXN,
      abi: VotingEscrowAbi,
      functionName: 'totalSupply',
    }) as Promise<bigint>,
    client.readContract({
      address: veBoost,
      abi: VotingEscrowBoostAbi,
      functionName: 'delegatedBalance',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: veBoost,
      abi: VotingEscrowBoostAbi,
      functionName: 'delegableBalance',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: veBoost,
      abi: VotingEscrowBoostAbi,
      functionName: 'adjustedVeBalance',
      args: [userAddress as `0x${string}`],
    }) as Promise<bigint>,
    client.readContract({
      address: feeDistributor,
      abi: FeeDistributorAbi,
      functionName: 'tokens_per_week',
      args: [lastThursday],
    }) as Promise<bigint>,
  ])

  const rawAmount = lockedData?.amount ?? 0n
  const lockedAmount = rawAmount < 0n ? -rawAmount : rawAmount
  const lockEnd = lockedData?.end ?? 0n

  let lockStatus: 'no-lock' | 'active' | 'expired'
  if (lockedAmount === 0n) {
    lockStatus = 'no-lock'
  } else if (lockEnd > BigInt(now)) {
    lockStatus = 'active'
  } else {
    lockStatus = 'expired'
  }

  let pendingWstETH = 0n
  try {
    const { result } = await client.simulateContract({
      address: feeDistributor,
      abi: FeeDistributorAbi,
      functionName: 'claim',
      args: [userAddress as `0x${string}`],
      account: userAddress as `0x${string}`,
    })
    pendingWstETH = result as bigint
  } catch {
    pendingWstETH = 0n
  }

  return {
    lockedAmount,
    lockEnd,
    vePower,
    lockStatus,
    veTotalSupply,
    pendingWstETH,
    delegatedBalance,
    delegableBalance,
    adjustedVeBalance,
    weeklyFeeAmount,
  }
}

export async function createLock(
  request: CreateLockRequest
): Promise<CreateLockResult> {
  const { userAddress, amount, unlockTime } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }
  const now = Math.floor(Date.now() / 1000)
  if (unlockTime <= now) {
    throw new Error('Unlock time must be in the future')
  }

  const alignedTime = alignToWeek(unlockTime)
  const client = getClient()
  const txs: FxSaveTx[] = []
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const approveTx = await approveToken({
    tokenAddress: fxnToken,
    amount,
    spender: veFXN,
    userAddress,
  })
  if (approveTx) {
    txs.push({ ...approveTx, nonce: nonce++, chainId })
  }

  const data = encodeFunctionData({
    abi: VotingEscrowAbi,
    functionName: 'create_lock',
    args: [amount, BigInt(alignedTime)],
  })

  txs.push({
    type: 'lock',
    from: userAddress,
    to: contracts.veFXN,
    data,
    value: 0n,
    nonce: nonce++,
    chainId,
  })

  return { txs }
}

export async function increaseLockAmount(
  request: IncreaseLockAmountRequest
): Promise<IncreaseLockAmountResult> {
  const { userAddress, amount } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  const client = getClient()
  const txs: FxSaveTx[] = []
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const approveTx = await approveToken({
    tokenAddress: fxnToken,
    amount,
    spender: veFXN,
    userAddress,
  })
  if (approveTx) {
    txs.push({ ...approveTx, nonce: nonce++, chainId })
  }

  txs.push({
    type: 'lock',
    from: userAddress,
    to: contracts.veFXN,
    data: encodeFunctionData({
      abi: VotingEscrowAbi,
      functionName: 'increase_amount',
      args: [amount],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  })

  return { txs }
}

export async function extendLockTime(
  request: ExtendLockTimeRequest
): Promise<ExtendLockTimeResult> {
  const { userAddress, unlockTime } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  const now = Math.floor(Date.now() / 1000)
  if (unlockTime <= now) {
    throw new Error('Unlock time must be in the future')
  }

  const alignedTime = alignToWeek(unlockTime)
  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [{
    type: 'lock',
    from: userAddress,
    to: contracts.veFXN,
    data: encodeFunctionData({
      abi: VotingEscrowAbi,
      functionName: 'increase_unlock_time',
      args: [BigInt(alignedTime)],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  }]

  return { txs }
}

export async function withdrawLock(
  request: WithdrawLockRequest
): Promise<WithdrawLockResult> {
  const { userAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [{
    type: 'withdraw',
    from: userAddress,
    to: contracts.veFXN,
    data: encodeFunctionData({
      abi: VotingEscrowAbi,
      functionName: 'withdraw',
      args: [],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  }]

  return { txs }
}

export async function claimLockRewards(
  request: ClaimLockRewardsRequest
): Promise<ClaimLockRewardsResult> {
  const { userAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [{
    type: 'claim',
    from: userAddress,
    to: contracts.FeeDistributor,
    data: encodeFunctionData({
      abi: FeeDistributorAbi,
      functionName: 'claim',
      args: [userAddress as `0x${string}`],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  }]

  return { txs }
}

export async function delegateBoost(
  request: DelegateBoostRequest
): Promise<DelegateBoostResult> {
  const { userAddress, receiver, amount, endTime } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (!isAddress(receiver)) {
    throw new Error('Receiver must be a valid Ethereum address')
  }

  const alignedEndTime = alignToWeek(endTime)
  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [{
    type: 'boost',
    from: userAddress,
    to: contracts.VotingEscrowBoost,
    data: encodeFunctionData({
      abi: VotingEscrowBoostAbi,
      functionName: 'boost',
      args: [receiver as `0x${string}`, amount, BigInt(alignedEndTime)],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  }]

  return { txs }
}

export async function undelegateBoost(
  request: UndelegateBoostRequest
): Promise<UndelegateBoostResult> {
  const { userAddress, boostIndex, initialAmount } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  const txs: FxSaveTx[] = [{
    type: 'unboost',
    from: userAddress,
    to: contracts.VotingEscrowBoost,
    data: encodeFunctionData({
      abi: VotingEscrowBoostAbi,
      functionName: 'unboost',
      args: [BigInt(boostIndex), initialAmount],
    }),
    value: 0n,
    nonce: nonce++,
    chainId,
  }]

  return { txs }
}
