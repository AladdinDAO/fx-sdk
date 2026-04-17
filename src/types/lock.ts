import type { FxSaveTx } from './fxsave'

/** Request for getLockInfo. */
export interface GetLockInfoRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Result of getLockInfo. */
export interface GetLockInfoResult {
  /** Locked FXN amount in wei (veFXN.locked(user).amount). */
  lockedAmount: bigint
  /** Lock end timestamp (veFXN.locked(user).end). */
  lockEnd: bigint
  /** Current veFXN voting power (veFXN.balanceOf(user)). */
  vePower: bigint
  /** Lock status: no-lock, active, or expired. */
  lockStatus: 'no-lock' | 'active' | 'expired'
  /** Total veFXN supply. */
  veTotalSupply: bigint
  /** Pending wstETH fee reward (FeeDistributor.claim simulate). */
  pendingWstETH: bigint
  /** Delegated veFXN balance (VotingEscrowBoost.delegatedBalance). */
  delegatedBalance: bigint
  /** Delegable veFXN balance (VotingEscrowBoost.delegableBalance). */
  delegableBalance: bigint
  /** Adjusted veFXN balance after boosts (VotingEscrowBoost.adjustedVeBalance). */
  adjustedVeBalance: bigint
  /** Weekly fee distribution amount (tokens_per_week). */
  weeklyFeeAmount: bigint
}

/** Request for createLock. */
export interface CreateLockRequest {
  /** User's wallet address. */
  userAddress: string
  /** Amount of FXN to lock in wei. */
  amount: bigint
  /** Unlock timestamp (auto-aligned to WEEK epoch). */
  unlockTime: number
}

/** Result of createLock. */
export interface CreateLockResult {
  txs: FxSaveTx[]
}

/** Request for increaseLockAmount. */
export interface IncreaseLockAmountRequest {
  /** User's wallet address. */
  userAddress: string
  /** Additional FXN amount to lock in wei. */
  amount: bigint
}

/** Result of increaseLockAmount. */
export interface IncreaseLockAmountResult {
  txs: FxSaveTx[]
}

/** Request for extendLockTime. */
export interface ExtendLockTimeRequest {
  /** User's wallet address. */
  userAddress: string
  /** New unlock timestamp (auto-aligned to WEEK epoch). */
  unlockTime: number
}

/** Result of extendLockTime. */
export interface ExtendLockTimeResult {
  txs: FxSaveTx[]
}

/** Request for withdrawLock. */
export interface WithdrawLockRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Result of withdrawLock. */
export interface WithdrawLockResult {
  txs: FxSaveTx[]
}

/** Request for claimLockRewards. */
export interface ClaimLockRewardsRequest {
  /** User's wallet address. */
  userAddress: string
}

/** Result of claimLockRewards. */
export interface ClaimLockRewardsResult {
  txs: FxSaveTx[]
}

/** Request for delegateBoost. */
export interface DelegateBoostRequest {
  /** User's wallet address. */
  userAddress: string
  /** Receiver of the boost delegation. */
  receiver: string
  /** Amount to delegate in wei. */
  amount: bigint
  /** Delegation end timestamp. */
  endTime: number
}

/** Result of delegateBoost. */
export interface DelegateBoostResult {
  txs: FxSaveTx[]
}

/** Request for undelegateBoost. */
export interface UndelegateBoostRequest {
  /** User's wallet address. */
  userAddress: string
  /** Boost token index to undelegate. */
  boostIndex: number
  /** Initial amount of the boost delegation. */
  initialAmount: bigint
}

/** Result of undelegateBoost. */
export interface UndelegateBoostResult {
  txs: FxSaveTx[]
}
