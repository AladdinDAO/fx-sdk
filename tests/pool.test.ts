import { describe, it, expect } from 'vitest'
import { Pool } from '../src/core/pool'
import { PoolName } from '../src/types/pool'

describe('Pool', () => {
  describe('constructor', () => {
    it('should create pool for wstETH', () => {
      const pool = new Pool({ poolName: PoolName.wstETH })
      expect(pool.config.poolName).toBe(PoolName.wstETH)
      expect(pool.config.isShort).toBe(false)
    })

    it('should create pool for WBTC', () => {
      const pool = new Pool({ poolName: PoolName.WBTC })
      expect(pool.config.poolName).toBe(PoolName.WBTC)
      expect(pool.config.isShort).toBe(false)
    })

    it('should create pool for wstETH_short', () => {
      const pool = new Pool({ poolName: PoolName.wstETH_short })
      expect(pool.config.poolName).toBe(PoolName.wstETH_short)
      expect(pool.config.isShort).toBe(true)
    })

    it('should create pool for WBTC_short', () => {
      const pool = new Pool({ poolName: PoolName.WBTC_short })
      expect(pool.config.poolName).toBe(PoolName.WBTC_short)
      expect(pool.config.isShort).toBe(true)
    })
  })

  describe('getPoolManagerAddress', () => {
    it('should return PoolManager for long pools', () => {
      const pool = new Pool({ poolName: PoolName.wstETH })
      const address = pool.getPoolManagerAddress()
      expect(address).toBeDefined()
      expect(typeof address).toBe('string')
    })

    it('should return ShortPoolManager for short pools', () => {
      const pool = new Pool({ poolName: PoolName.wstETH_short })
      const address = pool.getPoolManagerAddress()
      expect(address).toBeDefined()
      expect(typeof address).toBe('string')
    })
  })

  describe('getPoolInfo', () => {
    it(
      'should fetch pool info for wstETH',
      async () => {
        const pool = new Pool({ poolName: PoolName.wstETH })
        const poolInfo = await pool.getPoolInfo()
        
        expect(poolInfo).toBeDefined()
        expect(poolInfo.poolName).toBe(PoolName.wstETH)
        expect(poolInfo.collateralCapacity).toBeDefined()
        expect(poolInfo.debtCapacity).toBeDefined()
        expect(poolInfo.anchorPrice).toBeDefined()
        expect(poolInfo.minPrice).toBeDefined()
        expect(poolInfo.maxPrice).toBeDefined()
      },
      60000
    )

    it(
      'should fetch pool info for WBTC',
      async () => {
        const pool = new Pool({ poolName: PoolName.WBTC })
        const poolInfo = await pool.getPoolInfo()
        
        expect(poolInfo).toBeDefined()
        expect(poolInfo.poolName).toBe(PoolName.WBTC)
      },
      60000
    )

    it(
      'should fetch pool info for wstETH_short',
      async () => {
        const pool = new Pool({ poolName: PoolName.wstETH_short })
        const poolInfo = await pool.getPoolInfo()
        
        expect(poolInfo).toBeDefined()
        expect(poolInfo.poolName).toBe(PoolName.wstETH_short)
        expect(poolInfo.isShort).toBe(true)
      },
      60000
    )

    it(
      'should fetch pool info for WBTC_short',
      async () => {
        const pool = new Pool({ poolName: PoolName.WBTC_short })
        const poolInfo = await pool.getPoolInfo()
        
        expect(poolInfo).toBeDefined()
        expect(poolInfo.poolName).toBe(PoolName.WBTC_short)
        expect(poolInfo.isShort).toBe(true)
      },
      60000
    )
  })
})

