import ERC20Abi from '@/abis/ERC20.json'
import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import { tokens } from '@/configs/tokens'

export const callDecimals = async (address: string) => {
  if (address === tokens.eth) {
    return 18
  }

  return (await getClient().readContract({
    address: address as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'decimals',
  })) as bigint
}

export const callQueryConvert = async (
  amount: bigint,
  convertData: { encoding: bigint; routes: string[] }
) => {
  return (await getClient().readContract({
    address: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
    abi: MultiPathConverterAbi,
    functionName: 'queryConvert',
    args: [amount, convertData.encoding, convertData.routes],
  })) as bigint
}
