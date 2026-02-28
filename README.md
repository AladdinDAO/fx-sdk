# FX SDK

FX Protocol SDK is a TypeScript SDK for interacting with the FX Protocol. It provides comprehensive functionality for creating and managing leveraged positions.

## Installation

```bash
npm install @aladdindao/fx-sdk
# or
yarn add @aladdindao/fx-sdk
# or
pnpm add @aladdindao/fx-sdk
```

## Import Guide

The SDK's main entry point exports:

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'
import type { FxSdkConfig } from '@aladdindao/fx-sdk'
```

The `tokens` object contains common token addresses on Ethereum mainnet, so you don't need to define them yourself.

## Quick Start

### Initialize SDK

```typescript
import { FxSdk } from '@aladdindao/fx-sdk'

// Use default configuration (mainnet)
const sdk = new FxSdk()

// Use custom RPC URL and chain ID
const sdk = new FxSdk({
  rpcUrl: 'https://your-rpc-url.com',
  chainId: 1, // Mainnet
})
```

### Increase Position

Open a new position or add to an existing position:

```typescript
import { FxSdk } from '@aladdindao/fx-sdk'

const sdk = new FxSdk()

const result = await sdk.increasePosition({
  market: 'ETH', // 'ETH' or 'BTC'
  type: 'long',  // 'long' or 'short'
  positionId: 0, // 0 means open new position, > 0 means existing position ID
  leverage: 3, // Leverage multiplier
  inputTokenAddress: tokens.weth, // Input token address
  amount: 100000000000000000000n, // Input amount (wei units, 1 ETH = 10^18)
  slippage: 1, // Slippage tolerance (percentage, e.g., 1 means 1%)
  userAddress: '0x...', // User address
  targets: [], // Optional: specify route types
})

// result contains multiple route options
// result.routes is an array, each route contains:
// - routeType: Route type
// - positionId: Position ID
// - newLeverage: New leverage multiplier
// - slippage: Slippage
// - priceImpact: Price impact
// - colls: Collateral amount
// - debts: Debt amount
// - txs: Transaction array (contains approve and trade transactions with nonce set)
```

### Get Positions

Get all positions for a user in a specific market and position type:

```typescript
const positions = await sdk.getPositions({
  userAddress: '0x...',
  market: 'ETH', // 'ETH' or 'BTC'
  type: 'long',  // 'long' or 'short'
})

// positions is an array of position info objects, each containing:
// - rawColls: bigint - Raw collateral amount
// - rawDebts: bigint - Raw debt amount
// - currentLeverage: number - Current leverage multiplier
// - lsdLeverage: number - LSD leverage multiplier
```

### Reduce Position

Reduce or close a position:

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

const result = await sdk.reducePosition({
  market: 'ETH', // 'ETH' or 'BTC'
  type: 'long',  // 'long' or 'short'
  positionId: 706, // Existing position ID
  outputTokenAddress: tokens.wstETH, // Output token address
  amount: 30000000000000000n, // Amount to reduce (wei units)
  slippage: 1,
  userAddress: '0x...',
  isClosePosition: false, // true means fully close position
})
```

### Adjust Leverage

Adjust the leverage multiplier of an existing position:

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

const result = await sdk.adjustPositionLeverage({
  market: 'ETH', // 'ETH' or 'BTC'
  type: 'long',  // 'long' or 'short'
  positionId: 706,
  leverage: 3, // New leverage multiplier
  slippage: 1,
  userAddress: '0x...',
})
```

### Deposit and Mint

Deposit collateral to a position and mint fxUSD:

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

const result = await sdk.depositAndMint({
  market: 'ETH', // 'ETH' or 'BTC' (only supports long positions)
  positionId: 706,
  depositTokenAddress: tokens.stETH, // Deposit token address
  depositAmount: 1000000000000000000n, // Deposit amount (1 ETH)
  mintAmount: 1000000000000000000000n, // Amount of fxUSD to mint
  userAddress: '0x...',
})
```

### Repay and Withdraw

Repay debt and withdraw collateral:

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

const result = await sdk.repayAndWithdraw({
  market: 'ETH', // 'ETH' or 'BTC' (only supports long positions)
  positionId: 706,
  repayAmount: 500000000000000000000n, // Amount of fxUSD to repay
  withdrawAmount: 200000000000000000n, // Amount of collateral to withdraw
  withdrawTokenAddress: tokens.wstETH, // Withdraw token address
  userAddress: '0x...',
})
```

### Bridge (Base <-> Ethereum)

Bridge tokens between Ethereum and Base via LayerZero V2 (fxUSD, fxSAVE). Quote first, then build the tx and send on the **source** chain.

```typescript
import { FxSdk } from '@aladdindao/fx-sdk'

const sdk = new FxSdk({ rpcUrl: sourceRpcUrl, chainId: sourceChainId }) // source chain: 1 or 8453

// 1. Get fee quote
const quote = await sdk.getBridgeQuote({
  sourceChainId: 1,       // 1 = Ethereum, 8453 = Base
  destChainId: 8453,      // must differ from sourceChainId
  token: 'fxUSD',         // 'fxUSD' | 'fxSAVE' or OFT address
  amount: 100000000000000000n, // 0.1 in wei (18 decimals)
  recipient: '0x...',     // destination address
})
// quote: { nativeFee, lzTokenFee } in wei

// 2. Build tx payload
const result = await sdk.buildBridgeTx({
  sourceChainId: 1,
  destChainId: 8453,
  token: 'fxUSD',
  amount: 100000000000000000n,
  recipient: '0x...',
  refundAddress: '0x...', // optional; defaults to recipient
})
// result.tx: { to, data, value } — send this on source chain
// result.quote: same as getBridgeQuote

// 3. Send the tx (e.g. with viem walletClient.sendTransaction(result.tx))
```

When bridging **from Ethereum**, approve the bridge contract (`result.tx.to`) to spend your token (e.g. fxUSD) before sending the bridge tx. See `example/layerzero-bridge.ts` for a full script.

## Supported Markets

The SDK supports the following markets and position types:

- **ETH Market**:
  - `market: 'ETH', type: 'long'` - wstETH long pool
  - `market: 'ETH', type: 'short'` - wstETH short pool
- **BTC Market**:
  - `market: 'BTC', type: 'long'` - WBTC long pool
  - `market: 'BTC', type: 'short'` - WBTC short pool

## Supported Tokens

The SDK provides addresses for commonly used tokens. You need to use the token contract addresses, common token addresses are as follows:

```typescript
// Common token addresses (Ethereum mainnet)
const tokens = {
  fxUSD: '0x085780639cc2cacd35e474e71f4d000e2405d8f6',
  wstETH: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  eth: '0x0000000000000000000000000000000000000000', // Native ETH
  weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  stETH: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
}
```

## Transaction Execution

The transaction array returned by the SDK already includes the required approve transactions and the main transaction, and each transaction has been assigned the correct nonce to ensure sequential execution.

```typescript
const result = await sdk.increasePosition({...})

// Iterate through route options
for (const route of result.routes) {
  // route.txs is an array of transactions, executed in order
  // Usually contains:
  // 1. approveToken transaction (if needed)
  // 2. approvePosition transaction (if needed, only when positionId > 0)
  // 3. Main transaction (trade)
  
  for (const tx of route.txs) {
    // tx.type: 'approveToken' | 'approvePosition' | 'trade'
    // tx.from: Sender address
    // tx.to: Target contract address
    // tx.data: Transaction data
    // tx.nonce: Transaction nonce (already set)
    
    // Use your wallet to send transaction
    // await wallet.sendTransaction(tx)
  }
}
```

## Type Definitions

### Market

```typescript
type Market = 'ETH' | 'BTC'
```

### PositionType

```typescript
type PositionType = 'long' | 'short'
```

### FxSdkConfig

```typescript
interface FxSdkConfig {
  rpcUrl?: string  // Optional: RPC URL, defaults to configured value
  chainId?: number // Optional: Chain ID, default is 1 (mainnet)
}
```

### IncreasePositionRequest

```typescript
interface IncreasePositionRequest {
  market: Market            // 'ETH' or 'BTC'
  type: PositionType        // 'long' or 'short'
  positionId: number        // 0 means open new position, > 0 means existing position ID
  leverage: number          // Leverage multiplier
  inputTokenAddress: string // Input token address
  amount: bigint           // Input amount (wei units)
  slippage: number         // Slippage tolerance (percentage)
  userAddress: string      // User address
  targets?: ROUTE_TYPES[]  // Optional: specify route types
}
```

### ReducePositionRequest

```typescript
interface ReducePositionRequest {
  market: Market            // 'ETH' or 'BTC'
  type: PositionType        // 'long' or 'short'
  positionId: number
  outputTokenAddress: string // Output token address
  amount: bigint            // Amount to reduce (wei units)
  slippage: number
  userAddress: string
  isClosePosition?: boolean // Whether to fully close position
  targets?: ROUTE_TYPES[]
}
```

### AdjustPositionLeverageRequest

```typescript
interface AdjustPositionLeverageRequest {
  market: Market            // 'ETH' or 'BTC'
  type: PositionType        // 'long' or 'short'
  positionId: number
  leverage: number    // New leverage multiplier
  slippage: number
  userAddress: string
  targets?: ROUTE_TYPES[]
}
```

### GetPositionsRequest

```typescript
interface GetPositionsRequest {
  userAddress: string  // User address
  market: Market       // 'ETH' or 'BTC'
  type: PositionType   // 'long' or 'short'
}
```

### PositionInfo

```typescript
interface PositionInfo {
  rawColls: bigint      // Raw collateral amount
  rawDebts: bigint      // Raw debt amount
  currentLeverage: number  // Current leverage multiplier
  lsdLeverage: number   // LSD leverage multiplier
}
```

### DepositAndMintRequest 
```typescript
interface DepositAndMintRequest {
  market: Market            // 'ETH' or 'BTC' (only supports long positions)
  positionId: number
  userAddress: string
  depositTokenAddress: string
  depositAmount: bigint
  mintAmount: bigint
}
```

### RepayAndWithdrawRequest
```typescript
export interface RepayAndWithdrawRequest {
  market: Market            // 'ETH' or 'BTC' (only supports long positions)
  positionId: number
  userAddress: string
  repayAmount: bigint
  withdrawAmount: bigint
  withdrawTokenAddress: string
}
```

### Bridge (Base <-> Ethereum)

```typescript
// Quote
interface BridgeQuoteRequest {
  sourceChainId: 1 | 8453  // Ethereum or Base
  destChainId: 1 | 8453    // must differ from sourceChainId
  token: string            // 'fxUSD' | 'fxSAVE' or OFT address on source chain
  amount: bigint
  recipient: string
  sourceRpcUrl?: string
}
// Result: { nativeFee: bigint, lzTokenFee: bigint }

// Build tx
interface BuildBridgeTxRequest extends BridgeQuoteRequest {
  refundAddress?: string
}
// Result: { tx: { to, data, value }, quote }
```

## Important Notes

1. **Amount Units**: All amounts use wei units (bigint). For example, 1 ETH = `1000000000000000000n` (10^18).

2. **Nonce Management**: The SDK automatically sets the correct nonce for transactions to ensure sequential execution. Each time you call an SDK method, it fetches the current nonce and assigns from that value.

3. **Position ID**:
   - `positionId = 0`: Open new position
   - `positionId > 0`: Operate on existing position (must be the owner of that position)

4. **Slippage**: Slippage is expressed as a percentage (e.g., 1 means 1%), should be between 0 and 100.

5. **RPC Client**: The SDK uses a singleton pattern to manage the RPC client, with only one client instance globally. The configuration passed during first initialization is used, and subsequent calls reuse the same client.

6. **Error Handling**: All methods may throw errors, please use try-catch for error handling.

7. **Bridge**: Only Ethereum (1) and Base (8453) are supported. Use `getBridgeQuote` then `buildBridgeTx`; send the returned `tx` on the source chain. When the source is Ethereum, approve `tx.to` (RootEndPointV2) to spend your token first. See `example/layerzero-bridge.ts`.

## Example

### Complete Open Position Example

```typescript
import { FxSdk, tokens } from '@aladdindao/fx-sdk'

async function openPosition() {
  const sdk = new FxSdk({
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    chainId: 1,
  })

  try {
    const result = await sdk.increasePosition({
      market: 'ETH',
      type: 'long',
      positionId: 0, // Open new position
      leverage: 3,
      inputTokenAddress: tokens.weth,
      amount: 100000000000000000000n, // 100 ETH
      slippage: 1,
      userAddress: '0xYourAddress',
    })

    console.log(`Found ${result.routes.length} route options`)

    // Select the first route (usually the best)
    const selectedRoute = result.routes[0]
    
    // Execute transactions
    for (const tx of selectedRoute.txs) {
      // Use your wallet to send transaction
      console.log('Sending transaction:', tx.type, 'nonce:', tx.nonce)
      // const hash = await wallet.sendTransaction(tx)
      // await waitForTransaction(hash)
    }

    console.log(`Position ID: ${selectedRoute.positionId}`)
    console.log(`New leverage: ${selectedRoute.newLeverage}`)
  } catch (error) {
    console.error('Transaction failed:', error)
  }
}
```

## Disclaimer

**IMPORTANT LEGAL NOTICE**

This software is provided "as is" without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

**RISK WARNING**

- **Financial Risk**: Trading leveraged positions involves significant financial risk. You may lose all or more than your initial investment. Only trade with funds you can afford to lose.
- **Smart Contract Risk**: This SDK interacts with smart contracts on the blockchain. Smart contracts may contain bugs, vulnerabilities, or may not function as intended. Always audit and verify smart contracts before interacting with them.
- **Market Risk**: Cryptocurrency markets are highly volatile. Prices can change rapidly, and slippage may occur during transaction execution.
- **Technical Risk**: Network congestion, RPC failures, or other technical issues may cause transactions to fail or execute at unexpected prices.
- **Regulatory Risk**: Cryptocurrency regulations vary by jurisdiction. Ensure compliance with local laws and regulations.
- **No Financial Advice**: This SDK is a technical tool and does not constitute financial, investment, or trading advice. Always conduct your own research and consult with qualified financial advisors before making investment decisions.

**USE AT YOUR OWN RISK**

By using this SDK, you acknowledge that you understand and accept all risks associated with trading leveraged positions and interacting with smart contracts. The developers and contributors of this SDK are not responsible for any losses, damages, or liabilities that may arise from the use of this software.

## Agent-friendly usage

- **[AGENTS.md](./AGENTS.md)** — When to use each operation, parameter rules, errors.
- **Type exports** — Request/response types exported from the package.
- **[agent-tools.json](./agent-tools.json)** — JSON Schema for tool registration; amounts are decimal strings, convert to `bigint` before calling the SDK.

## License

MIT
