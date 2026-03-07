import { getClient } from '@/core/client'
import { contracts } from '@/configs/contracts'
import { tokens } from '@/configs/tokens'
import { encodeFunctionData } from 'viem'
import { isAddress } from 'viem'
import SavingFxUSDAbi from '@/abis/SavingFxUSD.json'
import SavingFxUSDFacetAbi from '@/abis/SavingFxUSDFacet.json'
import FxUSDBasePoolAbi from '@/abis/FxUSDBasePool.json'
import MultiPathConverterAbi from '@/abis/MultiPathConverter.json'
import type {
  GetFxSaveBalanceRequest,
  GetFxSaveBalanceResult,
  GetFxSaveRedeemStatusRequest,
  GetFxSaveRedeemStatusResult,
  GetFxSaveClaimableRequest,
  GetFxSaveClaimableResult,
  FxSaveClaimPreviewReceive,
  GetRedeemTxRequest,
  GetRedeemTxResult,
  FxSaveDepositRequest,
  FxSaveDepositResult,
  FxSaveWithdrawRequest,
  FxSaveWithdrawResult,
  FxSaveTx,
  FxSaveTokenIn,
} from '@/types/fxsave'
import { getNonce, getQueryConvert } from '@/utils/service'
import { getZapRoutes } from '@/utils/zapRoute'
import { approveToken } from '@/utils/approve'
import { FxRoute } from '@/core/aggregators/fxRoute'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const FEE_PRECISION = 10n ** 18n

function resolveTokenAddress(token: FxSaveTokenIn): string {
  const map: Record<FxSaveTokenIn, string> = {
    usdc: tokens.usdc,
    fxUSD: tokens.fxUSD,
    fxUSDBasePool: tokens.fxUSDBasePool,
  }
  return map[token]
}

/**
 * Gets user's fxSAVE balance (shares) and optional assets value.
 */
export async function getFxSaveBalance(
  request: GetFxSaveBalanceRequest
): Promise<GetFxSaveBalanceResult> {
  const { userAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()
  const balanceWei = (await client.readContract({
    address: contracts.FxSave_fxSAVE as `0x${string}`,
    abi: SavingFxUSDAbi,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
  })) as bigint

  let assetsWei: bigint | undefined
  if (balanceWei > 0n) {
    assetsWei = (await client.readContract({
      address: contracts.FxSave_fxSAVE as `0x${string}`,
      abi: SavingFxUSDAbi,
      functionName: 'convertToAssets',
      args: [balanceWei],
    })) as bigint
  }

  return { balanceWei, assetsWei }
}

/**
 * Gets Cooldown status: whether user has a pending redeem and if cooldown is complete.
 */
export async function getFxSaveRedeemStatus(
  request: GetFxSaveRedeemStatusRequest
): Promise<GetFxSaveRedeemStatusResult> {
  const { userAddress } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }

  const client = getClient()

  const [lockedProxy, cooldownPeriodRes] = await Promise.all([
    client.readContract({
      address: contracts.FxSave_fxSAVE as `0x${string}`,
      abi: SavingFxUSDAbi,
      functionName: 'lockedProxy',
      args: [userAddress as `0x${string}`],
    }) as Promise<string>,
    client.readContract({
      address: contracts.FxUSDBasePool as `0x${string}`,
      abi: FxUSDBasePoolAbi,
      functionName: 'redeemCoolDownPeriod',
    }) as Promise<bigint>,
  ])

  const proxy = (lockedProxy || '').toLowerCase()
  const noProxy =
    !proxy || proxy === ZERO_ADDRESS

  if (noProxy) {
    return {
      hasPendingRedeem: false,
      pendingSharesWei: 0n,
      cooldownPeriodSeconds: cooldownPeriodRes,
      redeemableAt: null,
      isCooldownComplete: false,
    }
  }

  const redeemRequestsRes = (await client.readContract({
    address: contracts.FxUSDBasePool as `0x${string}`,
    abi: FxUSDBasePoolAbi,
    functionName: 'redeemRequests',
    args: [proxy as `0x${string}`],
  })) as [bigint, bigint] | { amount: bigint; unlockAt: bigint }

  const amount = Array.isArray(redeemRequestsRes)
    ? (redeemRequestsRes[0] ?? 0n)
    : (redeemRequestsRes?.amount ?? 0n)
  const unlockAt = Array.isArray(redeemRequestsRes)
    ? (redeemRequestsRes[1] ?? 0n)
    : (redeemRequestsRes?.unlockAt ?? 0n)

  if (amount === 0n) {
    return {
      hasPendingRedeem: false,
      pendingSharesWei: 0n,
      cooldownPeriodSeconds: cooldownPeriodRes,
      redeemableAt: null,
      isCooldownComplete: false,
    }
  }

  const redeemableAt = Number(unlockAt)
  const block = await client.getBlock()
  const now = Number(block.timestamp)
  const isCooldownComplete = now >= redeemableAt

  return {
    hasPendingRedeem: true,
    pendingSharesWei: amount,
    cooldownPeriodSeconds: cooldownPeriodRes,
    redeemableAt,
    isCooldownComplete,
  }
}

/**
 * Gets claimable status and preview receive (align with app useFxSaveInfo willRedeemReceiveData + ClaimModal).
 * When hasPendingRedeem, includes previewReceive from FxUSDBasePool.previewRedeem(pendingSharesWei).
 */
export async function getFxSaveClaimable(
  request: GetFxSaveClaimableRequest
): Promise<GetFxSaveClaimableResult> {
  const status = await getFxSaveRedeemStatus(request)
  if (!status.hasPendingRedeem || status.pendingSharesWei === 0n) {
    return status
  }
  const client = getClient()
  const previewRes = (await client.readContract({
    address: contracts.FxUSDBasePool as `0x${string}`,
    abi: FxUSDBasePoolAbi,
    functionName: 'previewRedeem',
    args: [status.pendingSharesWei],
  })) as [bigint, bigint]
  const [amountYieldOutWei, amountStableOutWei] = previewRes
  return {
    ...status,
    previewReceive: {
      amountYieldOutWei,
      amountStableOutWei,
    },
  }
}

/**
 * Builds the claim tx after cooldown. Call when isCooldownComplete is true.
 * Uses claim(receiver) on FxSave_fxSAVE (same as app ClaimModal handleClaim_fxUSD_USDC).
 */
export async function getRedeemTx(
  request: GetRedeemTxRequest
): Promise<GetRedeemTxResult> {
  const { userAddress, receiver: receiverParam } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  const receiver = receiverParam ?? userAddress
  if (!isAddress(receiver)) {
    throw new Error('Receiver must be a valid Ethereum address')
  }

  const status = await getFxSaveRedeemStatus({ userAddress })
  if (!status.hasPendingRedeem) {
    throw new Error('No pending redeem request')
  }
  if (!status.isCooldownComplete) {
    throw new Error(
      'Cooldown not complete; redeem is available at ' +
        new Date(status.redeemableAt! * 1000).toISOString()
    )
  }

  const data = encodeFunctionData({
    abi: SavingFxUSDAbi,
    functionName: 'claim',
    args: [receiver as `0x${string}`],
  })

  const nonce = await getNonce(userAddress)
  const chainId = getClient().chain?.id

  const tx: FxSaveTx = {
    type: 'claim',
    from: userAddress,
    to: contracts.FxSave_fxSAVE,
    data,
    value: 0n,
    nonce,
    chainId,
  }

  return { txs: [tx] }
}

/** Spender that must be approved for each tokenIn when depositing. */
function getDepositSpender(tokenIn: FxSaveTokenIn): string {
  if (tokenIn === 'usdc' || tokenIn === 'fxUSD') {
    return contracts.Router_Diamond
  }
  return contracts.FxSave_fxSAVE
}

/**
 * Builds deposit tx(s) for fxSAVE. Supports USDC, fxUSD, and fxUSD Base Pool (Stability Pool).
 * Automatically checks allowance and prepends an approve tx when needed.
 */
export async function depositFxSave(
  request: FxSaveDepositRequest
): Promise<FxSaveDepositResult> {
  const { userAddress, tokenIn, amount, slippage = 0.1 } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }
  if (slippage <= 0 || slippage >= 100) {
    throw new Error('Slippage must be between 0 and 100 (exclusive)')
  }

  const tokenInAddress = resolveTokenAddress(tokenIn)
  const client = getClient()
  const txs: FxSaveTx[] = []
  let nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  // Auto check and handle approve first: ensure spender has sufficient allowance
  const spender = getDepositSpender(tokenIn)
  const approveTx = await approveToken({
    tokenAddress: tokenInAddress,
    amount,
    spender,
    userAddress,
  })
  if (approveTx) {
    txs.push({ ...approveTx, nonce: nonce++, chainId })
  }

  if (tokenIn === 'fxUSDBasePool') {
    const data = encodeFunctionData({
      abi: SavingFxUSDAbi,
      functionName: 'deposit',
      args: [amount, userAddress as `0x${string}`],
    })
    txs.push({
      type: 'deposit',
      from: userAddress,
      to: contracts.FxSave_fxSAVE,
      data,
      value: 0n,
      nonce: nonce++,
      chainId,
    })
    return { txs }
  }

  // USDC or fxUSD: depositToFxSave — follow app exactly (Deposit/index.js handleDeposit + getDepositPreview)
  // App getConverRouter: for fxUSD/usdc/basePool returns getFXUSDRouterV2ByAddress(from, from) → encoding 0, routes []
  const convertInRoute: { encoding: bigint; routes: string[] } =
    tokenInAddress.toLowerCase() === tokens.fxUSD.toLowerCase() ||
    tokenInAddress.toLowerCase() === tokens.usdc.toLowerCase()
      ? { encoding: 0n, routes: [] }
      : await (async () => {
          const fxRoute = new FxRoute()
          const quote = await fxRoute.getQuote({
            src: tokenInAddress,
            dst: tokens.fxUSD,
            amount,
          })
          return quote.convertData
        })()

  // App: convertMinOut = queryConvert(depositAmountInWei, encoding, routes) — raw, no slippage
  const convertMinOut = await getQueryConvert(amount, convertInRoute)

  // App getDepositPreview: _queryConvertMinOut = amountTokenToDeposit for usdc/fxUSD; _previewMintOut = previewDeposit(tokenIn, _queryConvertMinOut)
  const basePoolSharesOut = (await client.readContract({
    address: contracts.FxUSDBasePool as `0x${string}`,
    abi: FxUSDBasePoolAbi,
    functionName: 'previewDeposit',
    args: [tokenInAddress as `0x${string}`, amount],
  })) as bigint

  // App: convertMinOut (shares) = _previewMintOut / (indexRes/1e18) * (1 - 0.0004); indexRes = convertToAssets(1e18)
  const indexRes = (await client.readContract({
    address: contracts.FxSave_fxSAVE as `0x${string}`,
    abi: SavingFxUSDAbi,
    functionName: 'convertToAssets',
    args: [10n ** 18n],
  })) as bigint
  const minShares =
    indexRes > 0n
      ? (basePoolSharesOut * (10n ** 18n) * 9996n) / indexRes / 10000n
      : basePoolSharesOut

  // App: data = multiPathConverter.convert(tokenIn, amount, encoding, routes); contract expects uint256[] for routes
  const routesAsBigint = convertInRoute.routes.map((r) =>
    typeof r === 'string' ? BigInt(r) : r
  )
  const routeData = encodeFunctionData({
    abi: MultiPathConverterAbi,
    functionName: 'convert',
    args: [
      tokenInAddress as `0x${string}`,
      amount,
      convertInRoute.encoding,
      routesAsBigint,
    ],
  })
  const route = {
    to: contracts.TokenConverter_MultiPathConverter,
    data: routeData,
  }

  const convertInParams = {
    tokenIn: tokenInAddress as `0x${string}`,
    amount,
    target: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
    data: route.data as `0x${string}`,
    minOut: convertMinOut,
    signature: '0x' as `0x${string}`,
  }
  // App passes tokenOut = selectTokenInfo.address (same as tokenIn)
  const data = encodeFunctionData({
    abi: SavingFxUSDFacetAbi,
    functionName: 'depositToFxSave',
    args: [
      convertInParams,
      tokenInAddress as `0x${string}`,
      minShares,
      userAddress as `0x${string}`,
    ],
  })
  txs.push({
    type: 'depositToFxSave',
    from: userAddress,
    to: contracts.Router_Diamond,
    data,
    value: 0n,
    nonce: nonce++,
    chainId,
  })
  return { txs }
}

/**
 * Builds withdraw tx(s): either requestRedeem (default) or instantRedeemFromFxSave (instant, fee + slippage).
 */
export async function withdrawFxSave(
  request: FxSaveWithdrawRequest
): Promise<FxSaveWithdrawResult> {
  const { userAddress, tokenOut, amount, instant = false, slippage } = request
  if (!isAddress(userAddress)) {
    throw new Error('User address must be a valid Ethereum address')
  }
  if (amount <= 0n) {
    throw new Error('Amount must be greater than 0')
  }

  const tokenOutAddress = resolveTokenAddress(tokenOut)
  const client = getClient()
  const txs: FxSaveTx[] = []
  const nonce = await getNonce(userAddress)
  const chainId = client.chain?.id

  // App handleWithdraw: 1) fxUSDBasePool → redeem(); 2) isFast → instantRedeemFromFxSave(); 3) else → requestRedeem()
  if (tokenOut === 'fxUSDBasePool') {
    const data = encodeFunctionData({
      abi: SavingFxUSDAbi,
      functionName: 'redeem',
      args: [amount, userAddress as `0x${string}`, userAddress as `0x${string}`],
    })
    txs.push({
      type: 'redeem',
      from: userAddress,
      to: contracts.FxSave_fxSAVE,
      data,
      value: 0n,
      nonce,
      chainId,
    })
    return { txs }
  }

  if (!instant) {
    const data = encodeFunctionData({
      abi: SavingFxUSDAbi,
      functionName: 'requestRedeem',
      args: [amount],
    })
    txs.push({
      type: 'requestRedeem',
      from: userAddress,
      to: contracts.FxSave_fxSAVE,
      data,
      value: 0n,
      nonce,
      chainId,
    })
    return { txs }
  }

  if (tokenOut !== 'usdc' && tokenOut !== 'fxUSD') {
    throw new Error(
      'Instant withdraw only supports tokenOut usdc or fxUSD'
    )
  }
  if (slippage == null || slippage <= 0 || slippage >= 100) {
    throw new Error(
      'Slippage must be between 0 and 100 (exclusive) when instant is true'
    )
  }

  // Instant redeem pulls user's fxSAVE shares; must approve Router_Diamond to spend fxSAVE (see app Withdraw BtnWapper + useToken fx_v2_fxSAVE_facet)
  let instantNonce = nonce
  const approveTx = await approveToken({
    tokenAddress: contracts.FxSave_fxSAVE,
    amount,
    spender: contracts.Router_Diamond,
    userAddress,
  })
  if (approveTx) {
    txs.push({
      ...approveTx,
      nonce: instantNonce++,
      chainId,
    })
  }

  // App: _amountSpToWithdraw = amountTokenToWithdraw * index (fxSAVE shares -> base pool terms)
  const indexRes = (await client.readContract({
    address: contracts.FxSave_fxSAVE as `0x${string}`,
    abi: SavingFxUSDAbi,
    functionName: 'convertToAssets',
    args: [10n ** 18n],
  })) as bigint
  const amountInBasePool =
    indexRes > 0n ? (amount * indexRes) / (10n ** 18n) : amount

  const [previewRes, instantRedeemFeeRatioRes] = await Promise.all([
    client.readContract({
      address: contracts.FxUSDBasePool as `0x${string}`,
      abi: FxUSDBasePoolAbi,
      functionName: 'previewRedeem',
      args: [amountInBasePool],
    }) as Promise<[bigint, bigint]>,
    client.readContract({
      address: contracts.FxUSDBasePool as `0x${string}`,
      abi: FxUSDBasePoolAbi,
      functionName: 'instantRedeemFeeRatio',
    }) as Promise<bigint>,
  ])

  const [amountYieldOut, amountStableOut] = previewRes
  const fxUSDAfterFee =
    (amountYieldOut * (FEE_PRECISION - instantRedeemFeeRatioRes)) /
    FEE_PRECISION
  const usdcAfterFee =
    (amountStableOut * (FEE_PRECISION - instantRedeemFeeRatioRes)) /
    FEE_PRECISION

  const fxUsdRoutes = getZapRoutes({
    fromTokenAddress: tokens.fxUSD,
    toTokenAddress: tokenOutAddress,
  })
  const usdcRoutes = getZapRoutes({
    fromTokenAddress: tokens.usdc,
    toTokenAddress: tokenOutAddress,
  })

  const [tokenXOut, tokenYOut] = await Promise.all([
    getQueryConvert(fxUSDAfterFee, fxUsdRoutes),
    getQueryConvert(usdcAfterFee, usdcRoutes),
  ])
  // Use integer for BigInt: e.g. slippage 0.5 -> 9950/10000
  const slippageBps = BigInt(Math.floor((100 - slippage) * 100))
  const minOutX = (tokenXOut * slippageBps) / 10000n
  const minOutY = (tokenYOut * slippageBps) / 10000n

  // Contract expects uint256[] for routes; ensure bigint[]
  const toBigintRoutes = (r: readonly string[] | readonly bigint[]) =>
    r.map((x) => (typeof x === 'string' ? BigInt(x) : x))
  const fxusdParams = {
    tokenOut: tokenOutAddress as `0x${string}`,
    converter: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
    encodings: fxUsdRoutes.encoding,
    routes: toBigintRoutes(fxUsdRoutes.routes),
    minOut: minOutX,
    signature: '0x' as `0x${string}`,
  }
  const usdcParams = {
    tokenOut: tokenOutAddress as `0x${string}`,
    converter: contracts.TokenConverter_MultiPathConverter as `0x${string}`,
    encodings: usdcRoutes.encoding,
    routes: toBigintRoutes(usdcRoutes.routes),
    minOut: minOutY,
    signature: '0x' as `0x${string}`,
  }

  const data = encodeFunctionData({
    abi: SavingFxUSDFacetAbi,
    functionName: 'instantRedeemFromFxSave',
    args: [fxusdParams, usdcParams, amount, userAddress as `0x${string}`],
  })
  txs.push({
    type: 'instantRedeem',
    from: userAddress,
    to: contracts.Router_Diamond,
    data,
    value: 0n,
    nonce: instantNonce,
    chainId,
  })
  return { txs }
}

export type {
  GetFxSaveBalanceRequest,
  GetFxSaveBalanceResult,
  GetFxSaveRedeemStatusRequest,
  GetFxSaveRedeemStatusResult,
  GetFxSaveClaimableRequest,
  GetFxSaveClaimableResult,
  FxSaveClaimPreviewReceive,
  GetRedeemTxRequest,
  GetRedeemTxResult,
  FxSaveDepositRequest,
  FxSaveDepositResult,
  FxSaveWithdrawRequest,
  FxSaveWithdrawResult,
  FxSaveTx,
}
