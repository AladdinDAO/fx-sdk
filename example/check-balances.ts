import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, http, formatEther, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

async function main() {
  const pk = process.env.PRIVATE_KEY!.startsWith('0x')
    ? process.env.PRIVATE_KEY! as `0x${string}`
    : `0x${process.env.PRIVATE_KEY!}` as `0x${string}`

  const account = privateKeyToAccount(pk)
  console.log('Address:', account.address)

  const rpcUrl = process.env.RPC_URL!
  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) })

  const eth = await client.getBalance({ address: account.address })
  console.log('ETH:', formatEther(eth))

  const fxn = await client.readContract({
    address: '0x365AccFCa291e7D3914637ABf1F7635dB165Bb09',
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint
  console.log('FXN:', formatEther(fxn))
}

main().catch(console.error)
