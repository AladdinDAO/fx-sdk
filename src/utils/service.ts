import ERC20Abi from '@/abis/ERC20.json'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { tokens } from '@/configs/tokens'
import { ConvertData, PoolName } from '@/types'
import AFPoolAbi from '@/abis/AFPool.json'
import { pools } from '@/configs/pools'

/**
 * Get the number of decimals for a token.
 * @param address - Token contract address
 * @returns Number of decimals as bigint (18 for native ETH)
 */
export const getDecimals = async (address: string) => {
  if (address === tokens.eth) {
    return BigInt(18)
  }

  return (await getClient().readContract({
    address: address as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'decimals',
  })) as bigint
}

/**
 * Query the conversion result for a given amount and convert data.
 * @param amount - Amount to convert in wei units (bigint)
 * @param convertData - Convert data structure with encoding and routes
 * @returns Converted amount in wei units (bigint)
 */
export const getQueryConvert = async (
  amount: bigint,
  convertData: ConvertData
) => {
  return (await getClient().readContract({
    address: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
    abi: MultiPathConverterAbi,
    functionName: 'queryConvert',
    args: [amount, convertData.encoding, convertData.routes],
  })) as bigint
}

/**
 * Get the owner address of a position.
 * @param poolAddress - Pool contract address
 * @param positionId - Position ID
 * @returns Owner address
 */
export const getOwnerOf = async (poolAddress: string, positionId: number) => {
  return (await getClient().readContract({
    address: poolAddress as `0x${string}`,
    abi: AFPoolAbi,
    functionName: 'ownerOf',
    args: [positionId],
  })) as string
}

/**
 * Get the current transaction nonce for an address.
 * @param address - Wallet address
 * @returns Current transaction nonce
 */
export const getNonce = async (address: string) => {
  return (await getClient().getTransactionCount({
    address: address as `0x${string}`,
  })) as number
}

/**
 * Get all position IDs owned by a user from the subgraph.
 * @param poolName - Pool name identifier
 * @param userAddress - User's wallet address
 * @returns Array of position IDs
 */
export const getPositionsByUser = async (poolName: PoolName, userAddress: string) => {
  const response = await fetch(pools[poolName].graphUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `query MyQuery {
      positions(
        first: 1000
        where: {owner: "${userAddress.toLowerCase()}"}
        orderBy: blockNumber
        orderDirection: desc
      ) {
          id
        }
    }`,
    }),
  })

  const result = await response.json()

  const { data } = result as { data: { positions: { id: string }[] } }

  return data.positions.map((position) => Number(position.id))
}