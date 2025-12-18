import { cloneDeep } from 'es-toolkit'
import { tokens } from '@/configs/tokens'

const ROUTER = {
  stETH: {
    fromAddress: tokens.stETH,
    routers: {
      [tokens.weth]: [
        tokens.weth,
        ['0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804'],
      ],
      [tokens.usdc]: [
        tokens.usdc,
        [
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
          '0x49fe1afc5df753cd252e1068dfa0428d3755b20a6c08',
        ],
      ],
      [tokens.usdt]: [
        tokens.usdt,
        [
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
          '0x4bd7d6e5d89150b5caa781bc12012fe06ea8578ad008',
        ],
      ],
      [tokens.wstETH]: [
        tokens.wstETH,
        ['0x1fce71607d656d4f172c66f42cfe369b24d78b2810a'],
        1048575n + (1n << 20n),
      ],
    },
  },
  wstETH: {
    fromAddress: tokens.wstETH,
    routers: {
      [tokens.stETH]: [
        tokens.stETH,
        ['0x1fce71607d656d4f172c66f42cfe369b24d78b2820a'],
        1048575n + (1n << 20n),
      ],
      [tokens.weth]: [
        tokens.weth,
        [
          '0x1fce71607d656d4f172c66f42cfe369b24d78b2820a',
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.usdc]: [
        tokens.usdc,
        // ["wstETH/stETH_Lido","stETH/WETH_CrvSB","WETH/USDC_V3Uni500"]
        [
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2820a',
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
          '0x07d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
        ],
        1048575n + (3n << 20n),
      ],
      [tokens.usdt]: [
        tokens.usdt,
        // ["wstETH/stETH_Lido","stETH/WETH_CrvSB","WETH/USDT_V3Uni500"]
        // ["wstETH/stETH_Lido","stETH/WETH_CrvSB","WETH/USDC_V3Uni500", "USDC/USDT_CrvSB"]
        [
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2820a',
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
          // '0x040007d046e057bee3d604652b9e401b493836052dda5fd801',
          '0x07d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x022afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
        ],
        1048575n + (4n << 20n),
      ],
      [tokens.fxUSD]: [
        tokens.fxUSD,
        [
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2820a',
          '0x277090c5ae6b80a3c525f09d7ae464a8fa83d9c08804',
          '0x07d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c',
        ],
        1048575n + (4n << 20n),
      ],
    },
  },
  WETH: {
    fromAddress: tokens.weth,
    routers: {
      [tokens.wstETH]: [
        tokens.wstETH,
        [
          '0x2b9eae5948378e863978446d7aaac254c4b5ffa110a',
          '0x1fce71607d656d4f172c66f42cfe369b24d78b2810a',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.usdc]: [
        tokens.usdc,
        ['0x07d2239a830b7749bfbad93c0e68b104a5bf2cfd590001'],
        1048575n + (1n << 20n),
      ],
      [tokens.usdt]: [
        tokens.usdt,
        ['0x040007d046e057bee3d604652b9e401b493836052dda5fd801'],
        1048575n + (1n << 20n),
      ],
      [tokens.fxUSD]: [
        tokens.fxUSD,
        [
          '0x07d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c',
        ],
        1048575n + (2n << 20n),
      ],
    },
  },
  USDC: {
    fromAddress: tokens.usdc,
    routers: {
      [tokens.wstETH]: [
        tokens.wstETH,
        [
          '0x040007d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x02b9eae5948378e863978446d7aaac254c4b5ffa110a',
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2810a',
        ],
        1048575n + (3n << 20n),
      ],
      [tokens.fxUSD]: [
        tokens.fxUSD,
        ['0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c'],
        1048575n + (1n << 20n),
      ],
      [tokens.weth]: [
        tokens.weth,
        ['0x040007d2239a830b7749bfbad93c0e68b104a5bf2cfd590001'],
        1048575n + (1n << 20n),
      ],
      [tokens.WBTC]: [
        tokens.WBTC,
        ['0x2ee266b2329c21fe928a87ed8d5c9a659688052af0d401'], // V3Uni3000
        1048575n + (1n << 20n),
      ],
    },
  },
  USDT: {
    fromAddress: tokens.usdt,
    routers: {
      [tokens.wstETH]: [
        tokens.wstETH,
        // ["USDT/USDC_CrvSB","USDC/WETH_V3Uni500","WETH/stETH_Lido","stETH/wstETH_Lido"]
        [
          '0x014afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
          '0x040007d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x02b9eae5948378e863978446d7aaac254c4b5ffa110a',
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2810a',
        ],
        1048575n + (4n << 20n),
      ],
      [tokens.weth]: [
        tokens.weth,
        ['0x07d046e057bee3d604652b9e401b493836052dda5fd801'],
        1048575n + (1n << 20n),
      ],
      [tokens.WBTC]: [
        tokens.WBTC,
        // ["USDT/USDC_CrvSB","USDC/WBTC_V3Uni3000"]
        [
          '0x014afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
          '0x2ee266b2329c21fe928a87ed8d5c9a659688052af0d401',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.fxUSD]: [
        tokens.fxUSD,
        [
          '0x014afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
          '0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c',
        ],
        1048575n + (2n << 20n),
      ],
    },
  },
  WBTC: {
    fromAddress: tokens.WBTC,
    routers: {
      [tokens.usdc]: [
        tokens.usdc,
        // ["WBTC/USDC_V3Uni3000"]
        ['0x04002ee266b2329c21fe928a87ed8d5c9a659688052af0d401'],
        1048575n + (1n << 20n),
      ],
      [tokens.usdt]: [
        tokens.usdt,
        // ["WBTC/USDC_V3Uni3000","USDC/USDT_CrvSB"]
        [
          '0x04002ee266b2329c21fe928a87ed8d5c9a659688052af0d401',
          '0x022afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.fxUSD]: [
        tokens.fxUSD,
        [
          '0x04002ee266b2329c21fe928a87ed8d5c9a659688052af0d401',
          '0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c',
        ],
        1048575n + (2n << 20n),
      ],
    },
  },
  fxUSD: {
    fromAddress: tokens.fxUSD,
    routers: {
      [tokens.usdc]: [
        tokens.usdc,
        ['0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c'],
        1048575n + (1n << 20n),
      ],
      [tokens.usdt]: [
        tokens.usdt,
        [
          '0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c',
          '0x022afaf111e0b1f6c2869832dbfa5f42d20c0cbfc71c04',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.wstETH]: [
        tokens.wstETH,
        // ["fxUSD/USDC_CrvSN193","USDC/WETH_V3Uni500","WETH/stETH_Lido","stETH/wstETH_Lido"]
        [
          '0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c',
          '0x040007d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
          '0x02b9eae5948378e863978446d7aaac254c4b5ffa110a',
          '0x01fce71607d656d4f172c66f42cfe369b24d78b2810a',
        ],
        1048575n + (4n << 20n),
      ],
      [tokens.weth]: [
        tokens.weth,
        [
          '0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c',
          '0x040007d2239a830b7749bfbad93c0e68b104a5bf2cfd590001',
        ],
        1048575n + (2n << 20n),
      ],
      [tokens.WBTC]: [
        tokens.WBTC,
        // ["fxUSD/USDC_CrvSN193","USDC/WBTC_V3Uni3000"]
        [
          '0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c',
          '0x2ee266b2329c21fe928a87ed8d5c9a659688052af0d401',
        ],
        1048575n + (2n << 20n),
      ],
    },
  },
}

const ROUTER_v3 = cloneDeep(ROUTER)

ROUTER_v3.USDC.routers[tokens.WBTC] = [
  tokens.WBTC,
  ['0x07d269dc8063ef5dff34b49595f97151eebfcff5f45801'], // V3Uni500
  1048575n + (1n << 20n),
]

ROUTER_v3.WBTC.routers[tokens.usdc] = [
  tokens.usdc,
  ['0x040007d269dc8063ef5dff34b49595f97151eebfcff5f45801'],
  1048575n + (1n << 20n),
]

ROUTER_v3.fxUSD.routers[tokens.WBTC] = [
  tokens.WBTC,
  [
    '0x254062fa20b733978fcbcec244eb8825ae6cfed87c0c',
    '0x07d269dc8063ef5dff34b49595f97151eebfcff5f45801',
  ],
  1048575n + (2n << 20n),
]

ROUTER_v3.WBTC.routers[tokens.fxUSD] = [
  tokens.fxUSD,
  [
    '0x040007d269dc8063ef5dff34b49595f97151eebfcff5f45801',
    '0x01054062fa20b733978fcbcec244eb8825ae6cfed87c0c',
  ],
  1048575n + (2n << 20n),
]

export const getRouter = (
  fromAddress: string,
  toAddress: string,
  isV3 = false
) => {
  if (fromAddress.toLowerCase() == toAddress.toLowerCase()) {
    return [fromAddress, fromAddress, [], 0n]
  }

  const theRouter = isV3 ? ROUTER_v3 : ROUTER

  const router = Object.values(theRouter).find(
    (obj) => obj.fromAddress.toLowerCase() == fromAddress.toLowerCase()
  )?.routers[toAddress.toLowerCase()]

  if (!router) {
    throw new Error(`Router not found for ${fromAddress} to ${toAddress}`)
  }

  return router
}
