import { getClient } from '@/core/client'
import ERC20Abi from '@/abis/ERC20.json'
import { encodeFunctionData } from 'viem'
import { tokens } from '@/configs/tokens'
import PoolAbi from '@/abis/AFPool.json'

/**
 * Check if token approval is needed and return approval transaction if required.
 * @param tokenAddress - Token contract address
 * @param amount - Amount to approve in wei units (bigint)
 * @param spender - Spender contract address
 * @param userAddress - User's wallet address
 * @returns Approval transaction object or null if approval is not needed
 */
export const approveToken = async ({
  tokenAddress,
  amount,
  spender,
  userAddress,
}: {
  /** Token contract address */
  tokenAddress: string
  /** Amount to approve in wei units (bigint) */
  amount: bigint
  /** Spender contract address */
  spender: string
  /** User's wallet address */
  userAddress: string
}) => {
  if (tokenAddress === tokens.eth) {
    return null
  }

  const approvedAmount = (await getClient().readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'allowance',
    args: [userAddress, spender],
  })) as bigint

  if (approvedAmount >= amount) {
    return null
  }

  const data = encodeFunctionData({
    abi: ERC20Abi,
    functionName: 'approve',
    args: [spender, amount],
  })

  return {
    type: 'approveToken',
    from: userAddress,
    to: tokenAddress,
    data,
  }
}

/**
 * Check if position approval is needed and return approval transaction if required.
 * @param poolAddress - Pool contract address
 * @param positionId - Position ID (0 for new position, > 0 for existing position)
 * @param operator - Operator contract address
 * @param userAddress - User's wallet address
 * @param isApprovedForAll - Optional flag to check/approve for all positions
 * @returns Approval transaction object or null if approval is not needed
 */
export const approvePosition = async ({
  poolAddress,
  positionId,
  operator,
  userAddress,
  isApprovedForAll = false,
}: {
  /** Pool contract address */
  poolAddress: string
  /** Position ID (0 for new position, > 0 for existing position) */
  positionId: number
  /** Operator contract address */
  operator: string
  /** User's wallet address */
  userAddress: string
  /** Optional flag to check/approve for all positions */
  isApprovedForAll?: boolean
}) => {
  if (positionId === 0) {
    return null
  }

  if (isApprovedForAll) {
    const approved = await getClient().readContract({
      address: poolAddress as `0x${string}`,
      abi: PoolAbi,
      functionName: 'isApprovedForAll',
      args: [userAddress, operator],
    })
    if (approved) {
      return null
    }

    const data = encodeFunctionData({
      abi: PoolAbi,
      functionName: 'setApprovalForAll',
      args: [operator, true],
    })

    return {
      type: 'approvePositionForAll',
      from: userAddress,
      to: poolAddress,
      data,
    }
  }

  const approvedAddress = (await getClient().readContract({
    address: poolAddress as `0x${string}`,
    abi: PoolAbi,
    functionName: 'getApproved',
    args: [positionId],
  })) as string
  if (approvedAddress.toLowerCase() === operator.toLowerCase()) {
    return null
  }

  const data = encodeFunctionData({
    abi: PoolAbi,
    functionName: 'approve',
    args: [operator, positionId],
  })

  return {
    type: 'approvePosition',
    from: userAddress,
    to: poolAddress,
    data,
  }
}
