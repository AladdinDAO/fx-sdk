import { getClient } from '@/core/client'
import ERC20Abi from '@/abis/ERC20.json'
import { encodeFunctionData } from 'viem'
import { tokens } from '@/configs/tokens'
import PoolAbi from '@/abis/AFPool.json'

export const approveToken = async ({
  tokenAddress,
  amount,
  spender,
  userAddress,
}: {
  tokenAddress: string
  amount: bigint
  spender: string
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

export const approvePosition = async ({
  poolAddress,
  positionId,
  operator,
  userAddress,
  isApprovedForAll = false,
}: {
  poolAddress: string
  positionId: number
  operator: string
  userAddress: string
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
