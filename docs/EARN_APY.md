# Earn APY 计算 - SDK 设计说明

## 概述

FX SDK 提供的 Earn APY 计算功能返回 **总 APY**（Total APY），包括：
- **FXN APY**：来自 FXN 代币奖励的基础 APY
- **扩展 APY**（Extra APY）：来自 Convex 等额外奖励的 APY
- **总 APY** = FXN APY + 扩展 APY

**注意**：这些 APY 值不包括 veFXN boost 修正。实际应用中，前端应该根据用户的 veFXN 锁定情况调整显示的 APY。

## 职责边界

### SDK 层（当前实现）
✅ **负责**：
- 获取 gauge 列表和基础信息（权重、汇率、类型）
- 计算池子级别的**基础 FXN 奖励**
- 基于 `totalSupply` 计算**基础 APY**
- 提供透明的、可审计的计算逻辑

❌ **不负责**：
- veFXN boost 机制计算
- 用户级别的个性化 APY
- `working_supply` vs `totalSupply` 的差异修正
- 界面显示的 APY 格式（"当前 → 目标"）

### 应用层（前端实现）
✅ **负责**：
- 获取 `working_supply` 和 `working_balances`
- 计算 `repairBoost`（池子级别修正）
- 计算用户的 `votingBoost`（个人 boost，最高 2.5x）
- 根据用户状态显示动态 APY

## 计算公式

### SDK 层：总 APY 计算

```typescript
// 1. FXN 奖励（每周）
rewards = (FXNRate * weekSeconds * gaugeWeight * typeWeight) / precision^2

// 2. FXN APY（百分比）
fxnApy = (rewards * fxnPrice * weeksPerYear) / (totalSupply * lpPrice) * 100

// 3. 扩展 APY（从 Convex API 获取）
convexExtraApy = await getConvexExtraApy() // 返回 LP地址 -> 扩展APY 映射

// 4. 总 APY
totalApy = fxnApy + convexExtraApy[lpAddress]
```

### 应用层：Boost 修正

```typescript
// 1. 获取 working balances
working_supply = await gauge.workingSupply()
working_balances = await gauge.workingBalanceOf(user)

// 2. 计算 repairBoost（池子级别修正）
noboost_supply = totalSupply * 0.4  // 40% 无锁定基础部分
repairBoost = noboost_supply / working_supply  // 通常 0.8-1.2

// 3. 计算 votingBoost（用户级别 boost，最高 2.5x）
lim = deposit * 0.4
lim += totalSupply * (userVeFXN / totalVeFXN) * 0.6
lim = min(lim, deposit)
votingBoost = lim / (deposit * 0.4)  // 1.0 - 2.5

// 4. 显示 APY
minDisplayApy = baseApy * repairBoost          // 当前 boost 水平
maxDisplayApy = baseApy * repairBoost * 2.5    // 最大 boost
userDisplayApy = baseApy * votingBoost         // 用户实际 APY
```

## 使用示例

### SDK 使用（获取总 APY）

```typescript
import { FxSdk } from '@aladdindao/fx-sdk'

const sdk = new FxSdk()

// 1. 获取 gauge 列表
const { gauges } = await sdk.getGaugeList()

// 2. 获取基础信息
const baseInfo = await sdk.getGaugeBaseInfo(gauges)

// 3. 获取 Convex 扩展 APY
const convexExtraApys = await sdk.getConvexExtraApy()

// 4. 计算总 APY
const gaugeInfo = baseInfo.GaugeList[0]
const apy = await sdk.getGaugeApy({
  gaugeInfo: {
    ...gaugeInfo,
    totalSupply: 1000000n * 10n**18n,  // 需要从合约获取
    gaugeType: 0,
  },
  lpPrice: 343.35,       // 从价格预言机获取
  fxnPrice: 11.57,       // 从价格预言机获取
  baseInfo,
  convexExtraApy: convexExtraApys[gaugeInfo.lpAddress.toLowerCase()] || 0,
})

console.log(`FXN APY: ${apy.thisWeekApy}%`)      // FXN 奖励 APY
console.log(`Extra APY: ${apy.extraApy}%`)       // 扩展奖励 APY
console.log(`Total APY: ${apy.totalApy}%`)       // 总 APY
```

### 应用层扩展（实现 boost）

```typescript
// 前端需要额外实现：
// 1. 获取 working_supply
const working_supply = await client.readContract({
  address: gaugeAddress,
  abi: SharedLiquidityGaugeAbi,
  functionName: 'workingSupply',
})

// 2. 计算 repairBoost
const totalSupply = await client.readContract({
  address: gaugeAddress,
  abi: SharedLiquidityGaugeAbi,
  functionName: 'totalSupply',
})
const noboost_supply = Number(totalSupply) * 0.4 / 1e18
const repairBoost = noboost_supply / (Number(working_supply) / 1e18)

// 3. 显示修正后的 APY（对总 APY 应用 boost）
const baseTotalApy = parseFloat(apy.totalApy)
const minDisplayApy = baseTotalApy * repairBoost
const maxDisplayApy = minDisplayApy * 2.5

console.log(`APY: ${minDisplayApy.toFixed(2)}% → ${maxDisplayApy.toFixed(2)}%`)
```

## 数据对比示例

以 ETH+FXN pool 为例：

| 指标 | SDK 计算 | 真实显示 | 说明 |
|------|---------|---------|------|
| FXN APY | 24.07% | ~24% | 来自 FXN 代币奖励 |
| 扩展 APY | 0.70% | ~0.7% | 来自 Convex 额外奖励 |
| 总 APY | 24.77% | ~24.77% | FXN APY + 扩展 APY |
| repairBoost | N/A | ~0.02-1.2 | 应用层计算（池子级别修正） |
| 修正后 APY | N/A | 可变 | totalApy × repairBoost |
| 最大 boost APY | N/A | 可变 | minApy × 2.5 |

**计算方式**：
```
总 APY = FXN APY + 扩展 APY
       = 24.07% + 0.70%
       = 24.77%
```

**应用层调整**：
- 前端需要获取 `working_supply` 计算 `repairBoost`
- 根据用户 veFXN 锁定情况计算个人 boost（最高 2.5x）
- 最终显示：`totalApy × repairBoost × votingBoost`

## 参考实现

完整的 boost 实现请参考：
- **前端**: [aladdin-app-fxETH](https://github.com/AladdinDAO/aladdin-app-fxETH)
  - `hooks/calculator/useVeBoost.js` - Boost 计算逻辑
  - `modules/earn/controller/useGaugeController.js` - APY 显示逻辑
  - `hooks/useGaugeApyEstimate.js` - APY 估算

## 总结

SDK 提供的是**完整的总 APY 计算**（FXN + 扩展奖励），作为应用层构建的基石。这种设计：

✅ **优点**：
- SDK 返回完整的总 APY（FXN + 扩展奖励）
- 计算逻辑透明，易于审计和测试
- 应用层只需负责 boost 修正，简化了前端逻辑
- 职责边界清晰，便于维护

✅ **适用场景**：
- SDK 用于基础数据、价格获取和 APY 计算
- 前端负责用户交互和 boost 修正显示
- 不同应用可以根据需求调整显示逻辑

✅ **API 集成**：
- LP 价格 API：`https://api.aladdin.club/api1/lp/price`
- FXN 价格 API：`https://api.aladdin.club/api/coingecko/price`
- 扩展 APY API：`https://api.aladdin.club/api1/lp/convex`

如需完整的 boost 实现，请在前端应用层参考 aladdin-app-fxETH 的实现。
