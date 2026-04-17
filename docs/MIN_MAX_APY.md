# Min/Max APY 计算说明

## 概述

官方显示的 **Min APY** 和 **Max APY** 是基于 veFXN boost 机制计算的，用于展示给用户的 APY 范围。

## 计算公式

### 完整公式

```typescript
// 1. 基础 APY（SDK 提供）
baseApy = FXN APY + Extra APY

// 2. 获取 working balances（应用层实现）
working_supply = await gauge.workingSupply()
totalSupply = await gauge.totalSupply()

// 3. 计算 repairBoost（池子级别修正）
noboost_supply = totalSupply * 0.4
repairBoost = noboost_supply / working_supply
// 通常在 0.8 - 1.2 之间

// 4. 计算 Min/Max APY
Min APY = baseApy * repairBoost
Max APY = baseApy * repairBoost * 2.5
```

## 详细步骤

### Step 1: 获取基础 APY（SDK）

```typescript
import { FxSdk } from '@aladdindao/fx-sdk'

const sdk = new FxSdk()

// 获取基础数据
const { gauges } = await sdk.getGaugeList()
const baseInfo = await sdk.getGaugeBaseInfo(gauges)
const convexExtraApys = await sdk.getConvexExtraApy()

// 计算基础 APY
const apy = await sdk.getGaugeApy({
  gaugeInfo: { ... },
  lpPrice: 343.35,
  fxnPrice: 11.57,
  baseInfo,
  convexExtraApy: 12.58,
})

// baseApy = 31.27% (FXN: 18.69% + Extra: 12.58%)
```

### Step 2: 获取 Working Supply（应用层）

```typescript
const working_supply = await client.readContract({
  address: gaugeAddress,
  abi: SharedLiquidityGaugeAbi,
  functionName: 'workingSupply',
}) as bigint

const totalSupply = await client.readContract({
  address: gaugeAddress,
  abi: SharedLiquidityGaugeAbi,
  functionName: 'totalSupply',
}) as bigint
```

### Step 3: 计算 Repair Boost

```typescript
const totalSupplyFloat = Number(totalSupply) / 1e18
const workingSupplyFloat = Number(working_supply) / 1e18

// 40% 是无锁定基础部分
const noboost_supply = totalSupplyFloat * 0.4

// repairBoost 修正了实际 working supply 与理论值的偏差
const repairBoost = noboost_supply / workingSupplyFloat

// 示例值：
// totalSupply = 1,000,000 LP
// working_supply = 400,000 LP（假设所有人都有 boost）
// noboost_supply = 400,000 LP
// repairBoost = 400,000 / 400,000 = 1.0
```

### Step 4: 计算 Min/Max APY

```typescript
const baseApy = 31.27  // 从 SDK 获取的 totalApy

// Min APY：当前池子的平均 boost 水平
const minApy = baseApy * repairBoost
// = 31.27% * 1.0
// = 31.27%

// Max APY：最大 boost（2.5x）
const maxApy = baseApy * repairBoost * 2.5
// = 31.27% * 1.0 * 2.5
// = 78.18%
```

## 实际数据示例

### FXN+cvxFXN 池

假设链上数据：
- totalSupply = 100,000 LP
- working_supply = 50,000 LP
- baseApy = 31.27%

计算过程：
```typescript
1. noboost_supply = 100,000 * 0.4 = 40,000 LP
2. repairBoost = 40,000 / 50,000 = 0.8
3. Min APY = 31.27% * 0.8 = 25.02%
4. Max APY = 31.27% * 0.8 * 2.5 = 62.54%
```

显示结果：
```
APY: 25.02% → 62.54%
```

## 为什么需要 Repair Boost？

### 问题

Curve 的 boost 机制存在"衰减"问题：
- 理论上：40% 无 boost + 60% 有 boost
- 实际上：working_supply 可能 < totalSupply * 0.4

### 原因

1. **部分地址没有 veFXN**：导致 working supply 减少
2. **Boost 衰减**：长期锁定者的 boost 会缓慢衰减
3. **流动性分布不均**：大量 unstaked LP 影响

### 解决方案

```typescript
// 修正系数：将 baseApy 调整到实际水平
repairBoost = (totalSupply * 0.4) / working_supply

// 示例：
// 如果 working_supply 太低，repairBoost > 1.0
// 如果 working_supply 太高，repairBoost < 1.0
```

## 用户级别的 Boost

除了池子级别的 repairBoost，还有用户级别的 votingBoost：

```typescript
// 计算用户的个人 boost
const userVeFXN = await veFXN.balanceOf(userAddress)
const totalVeFXN = await veFXN.totalSupply()

const lim = deposit * 0.4
lim += totalSupply * (userVeFXN / totalVeFXN) * 0.6
lim = min(lim, deposit)

const votingBoost = lim / (deposit * 0.4)
// votingBoost 范围：1.0 - 2.5

// 用户实际 APY
const userApy = baseApy * votingBoost
```

## 前端实现示例

```typescript
// 获取 Min/Max APY
async function getMinMaxApy(gaugeAddress: string, baseApy: number) {
  // 1. 获取 working supply
  const working_supply = await publicClient.readContract({
    address: gaugeAddress,
    abi: SharedLiquidityGaugeAbi,
    functionName: 'workingSupply',
  })

  // 2. 获取 total supply
  const totalSupply = await publicClient.readContract({
    address: gaugeAddress,
    abi: SharedLiquidityGaugeAbi,
    functionName: 'totalSupply',
  })

  // 3. 计算 repair boost
  const totalSupplyFloat = Number(totalSupply) / 1e18
  const workingSupplyFloat = Number(working_supply) / 1e18
  const noboost_supply = totalSupplyFloat * 0.4
  const repairBoost = noboost_supply / workingSupplyFloat

  // 4. 计算 Min/Max APY
  const minApy = baseApy * repairBoost
  const maxApy = baseApy * repairBoost * 2.5

  return {
    minApy: minApy.toFixed(2),
    maxApy: maxApy.toFixed(2),
    repairBoost: repairBoost.toFixed(4),
  }
}
```

## 数据流总结

```
SDK 层（我们提供的）:
┌─────────────────────────────────────┐
│ baseApy = FXN APY + Extra APY       │
│ = 18.69% + 12.58%                   │
│ = 31.27%                            │
└─────────────────────────────────────┘
           ↓
应用层（前端实现）:
┌─────────────────────────────────────┐
│ repairBoost = (total * 0.4) / working│
│ = 0.8 (假设)                        │
│                                    │
│ Min APY = 31.27% * 0.8 = 25.02%     │
│ Max APY = 31.27% * 0.8 * 2.5 = 62.54%│
└─────────────────────────────────────┘
           ↓
显示给用户:
APY: 25.02% → 62.54%
```

## 参考实现

完整的前端 boost 实现：
- [aladdin-app-fxETH](https://github.com/AladdinDAO/aladdin-app-fxETH)
  - `hooks/calculator/useVeBoost.js` - Boost 计算逻辑
  - `modules/earn/controller/useGaugeController.js` - APY 显示逻辑
