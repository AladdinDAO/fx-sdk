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
  for (const [index, chunk] of callChunks.entries()) {
    try {
      const chunkResults = await client.multicall({ contracts: chunk });
      results = results.concat(chunkResults as MulticallResult[]);
    } catch (e) {
      results = results.concat(Array(chunk.length).fill(undefined));
    }
    if (index < callChunks.length - 1) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  return results;
}

/**
 * Runs consecutive batchedMulticall calls of one operation with the delay
 * between all of their batches, but not after the last one: each call after
 * the first waits before its first batch. Await each call before the next.
 * @param client - PublicClient instance for blockchain interaction
 * @returns Function running batchedMulticall for the given contract calls
 */
export function createBatchedMulticallSequence(client: PublicClient) {
  let started = false;
  return async (contracts: MulticallContractCall[]) => {
    if (started) {
      await new Promise((res) => setTimeout(res, DELAY_TIME_MS));
    }
    started = true;
    return batchedMulticall(client, contracts);
  };
}
