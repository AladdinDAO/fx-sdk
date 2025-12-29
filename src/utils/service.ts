import ERC20Abi from '@/abis/ERC20.json'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { tokens } from '@/configs/tokens'
import { ConvertData } from '@/types'
import AFPoolAbi from '@/abis/AFPool.json'

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

export const getOwnerOf = async (poolAddress: string, positionId: number) => {
  return (await getClient().readContract({
    address: poolAddress as `0x${string}`,
    abi: AFPoolAbi,
    functionName: 'ownerOf',
    args: [positionId],
  })) as string
}

export const getNonce = async (address: string) => {
  return (await getClient().getTransactionCount({
    address: address as `0x${string}`,
  })) as number
}
