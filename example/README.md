# FX SDK Examples

This folder contains example scripts for using the FX SDK to send transactions directly to the blockchain.

## Setup

1. **Install dependencies** (if not already installed):
```bash
npm install
# or
yarn install
```

2. **Copy `.env.example` to `.env`**:
```bash
cp example/.env.example example/.env
```

3. **Edit the `.env` file** and add your private key:
```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://eth.llamarpc.com
CHAIN_ID=1
```

**Note:** The `.env` file should be in the `example/` directory, not in the root directory.

**⚠️ Important Security Notes:**
- Never commit the `.env` file to version control
- Keep your private key secret and never share it with anyone
- It's recommended to use a test account's private key for testing

## How to Run Examples

There are two ways to run the example scripts:

### Method 1: Using npm scripts (Recommended)

After setting up your `.env` file, you can use the npm scripts defined in `package.json`:

```bash
# Increase position / Open new position
npm run example:increase

# Reduce position / Close position
npm run example:reduce

# Get all positions
npm run example:positions

# Deposit and mint
npm run example:deposit

# Repay and withdraw
npm run example:repay

# Adjust position leverage
npm run example:adjust
```

### Method 2: Using tsx directly

You can also run the scripts directly using `tsx`:

```bash
# Increase position / Open new position
npx tsx example/increase-position.ts

# Reduce position / Close position
npx tsx example/reduce-position.ts

# Get all positions
npx tsx example/get-positions.ts

# Deposit and mint
npx tsx example/deposit-and-mint.ts

# Repay and withdraw
npx tsx example/repay-and-withdraw.ts

# Adjust position leverage
npx tsx example/adjust-position-leverage.ts
```

## Available Scripts

### 1. increase-position.ts

Example script for increasing a position or opening a new position.

```bash
npm run example:increase
# or
npx tsx example/increase-position.ts
```

The script will:
- Create a wallet from the private key
- Call the SDK to get transaction routes
- Send all transactions sequentially (including approve and main transactions)
- Wait for transaction confirmations

### 2. reduce-position.ts

Example script for reducing a position or closing a position.

```bash
npm run example:reduce
# or
npx tsx example/reduce-position.ts
```

**Note:** You need to modify the `positionId` in the script to your actual position ID.

### 3. get-positions.ts

Example script for querying all positions for a user.

```bash
npm run example:positions
# or
npx tsx example/get-positions.ts
```

The script will query and display:
- ETH long positions
- ETH short positions
- BTC long positions
- BTC short positions

### 4. deposit-and-mint.ts

Example script for depositing collateral and minting fxUSD.

```bash
npm run example:deposit
# or
npx tsx example/deposit-and-mint.ts
```

**Note:** You need to modify the `positionId` in the script to your actual position ID (use 0 for a new position).

The script will:
- Deposit collateral tokens (stETH, weth, or wstETH for ETH; WBTC for BTC)
- Mint fxUSD tokens
- Execute all required transactions sequentially

### 5. repay-and-withdraw.ts

Example script for repaying debt and withdrawing collateral.

```bash
npm run example:repay
# or
npx tsx example/repay-and-withdraw.ts
```

**Note:** You need to modify the `positionId` in the script to your actual position ID.

The script will:
- Repay fxUSD debt
- Withdraw collateral tokens

### 6. adjust-position-leverage.ts

Example script for adjusting the leverage of an existing position.

```bash
npm run example:adjust
# or
npx tsx example/adjust-position-leverage.ts
```

**Note:** You need to modify the `positionId` in the script to your actual position ID, or set it via the `POSITION_ID` environment variable.

The script will:
- Adjust the leverage of an existing position (increase or decrease)
- Execute all required transactions sequentially
- Display the new leverage after adjustment
- Execute all required transactions sequentially

## Environment Variables

### PRIVATE_KEY (Required)

Your wallet private key. Can be with or without the `0x` prefix.

### RPC_URL (Optional)

RPC node URL, defaults to `https://eth.llamarpc.com`.

### CHAIN_ID (Optional)

Chain ID, defaults to `1` (mainnet).

### USER_ADDRESS (Optional, for get-positions.ts only)

User address for querying positions. If not set, it will be derived from PRIVATE_KEY.

## Custom Scripts

You can create your own scripts based on these examples. The basic structure is as follows:

```typescript
import { FxSdk } from '../src/core'
import { privateKeyToAccount } from 'viem/accounts'
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import * as dotenv from 'dotenv'

dotenv.config()

async function yourFunction() {
  // 1. Create account from private key
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x')
    ? (process.env.PRIVATE_KEY as `0x${string}`)
    : (`0x${process.env.PRIVATE_KEY}` as `0x${string}`)
  
  const account = privateKeyToAccount(privateKey)
  const userAddress = account.address

  // 2. Initialize SDK
  const sdk = new FxSdk({
    rpcUrl: process.env.RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '1'),
  })

  // 3. Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(process.env.RPC_URL),
  })

  // 4. Call SDK method to get transactions
  const result = await sdk.increasePosition({...})

  // 5. Send transactions
  for (const tx of result.routes[0].txs) {
    const hash = await walletClient.sendTransaction({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: tx.value || 0n,
      nonce: tx.nonce,
    })
    
    await walletClient.waitForTransactionReceipt({ hash })
  }
}
```

## Important Notes

1. **Gas Fees**: Sending transactions requires paying gas fees. Make sure your account has sufficient ETH.

2. **Nonce Management**: The SDK automatically manages nonces to ensure transactions are executed in order.

3. **Error Handling**: All scripts include error handling. If a transaction fails, an error message will be displayed.

4. **Testing**: It's recommended to test on a test network first to ensure the scripts work correctly before using them on mainnet.

5. **Transaction Confirmation**: Scripts will wait for transaction confirmations, which may take some time.

## Troubleshooting

### Transaction Failed

- Check if the account balance is sufficient to pay gas fees
- Check if the private key is correct
- Check if the RPC URL is accessible
- Check if the position ID is correct (for reduce-position)

### Positions Not Found

- Verify the user address is correct
- Verify the positions actually exist
- Check network connection
