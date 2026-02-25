import type { Abi, PublicClient } from "viem";

const MULTICALL_BATCH_SIZE = 50;
const DELAY_TIME_MS = 500;

/** Result type for multicall operations. */
export type MulticallResult = {
  /** Result data from the contract call */
  result?: unknown;
  /** Status of the call */
  status?: string;
  /** Error message if the call failed */
  error?: string;
};

/** Contract call configuration for multicall. */
export type MulticallContractCall = {
  /** Contract address */
  address: `0x${string}`;
  /** Contract ABI */
  abi: Abi;
  /** Function name to call */
  functionName: string;
  /** Optional function arguments */
  args?: readonly unknown[];
};

/**
 * Executes multiple contract calls in batches, with a delay between batches.
 * @param client - PublicClient instance for blockchain interaction
 * @param contracts - Array of contract calls to execute
 * @param batchSize - Number of calls per batch (default: 50)
 * @param delayMs - Delay in milliseconds between batches (default: 500)
 * @returns Array of results; entries are undefined for failed calls
 */
export async function batchedMulticall<MulticallResult>(
  client: PublicClient,
  contracts: MulticallContractCall[],
  batchSize = MULTICALL_BATCH_SIZE,
  delayMs = DELAY_TIME_MS
): Promise<(MulticallResult | undefined)[]> {
  function chunkArray<T>(
    arr: MulticallContractCall[],
    size: number
  ): MulticallContractCall[][] {
    const res: MulticallContractCall[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  }

  const callChunks = chunkArray(contracts, batchSize);
  let results: (MulticallResult | undefined)[] = [];
  for (const chunk of callChunks) {
    try {
      const chunkResults = await client.multicall({ contracts: chunk });
      results = results.concat(chunkResults as MulticallResult[]);
    } catch (e) {
      results = results.concat(Array(chunk.length).fill(undefined));
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return results;
}
