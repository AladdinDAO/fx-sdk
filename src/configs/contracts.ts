export const contracts = {
  // Base contracts
  EmptyContract: "0x387568e1ea4Ff4D003B8147739dB69D87325E206",
  FxProtocol_RevenuePool_slippageFee:
    "0x4Fb9445019ba1e3A39bD1dfBe9cC7815E0a3C285",
  FxProtocol_RevenuePool_OpenFee: "0x361f88157073B8522deF857761484CA7b1D5c8be",
  FxProtocol_RevenuePool_CloseFee: "0xD36845bd3Ce4Ea0D60aEfa6a902eBfd23Cf44dF7",
  FxProtocol_RevenuePool_MiscFee: "0x94172E0b1714792c54f0b077b64e37c8050e89D6",
  TokenConverter_MultiPathConverter:
    "0x12AF4529129303D7FbD2563E242C4a2890525912",

  // FxProtocol
  FxProtocol_FxUSD: "0x085780639CC2cACd35E474e71f4d000e2405d8f6",
  FxProtocol_FxUSDBasePool: "0x65C9A641afCEB9C0E6034e558A319488FA0FA3be",
  FxProtocol_PegKeeper: "0x50562fe7e870420F5AAe480B7F94EB4ace2fcd70",
  FxProtocol_ReservePool: "0x297dD69725911FE5F08B8F8C5EDdDb724D7D11df",
  FxProtocol_FxUSDBasePoolGaugeProxy:
    "0xEd92dDe3214c24Ae04F5f96927E3bE8f8DbC3289",
  FxProtocol_LinearMultipleRewardDistributor:
    "0xEd92dDe3214c24Ae04F5f96927E3bE8f8DbC3289",

  Router_Diamond: "0x33636D49FbefBE798e15e7F356E8DBef543CC708",
  // PositionOperateFacet
  FxMintRouter: "0xB753366082466c4B5984312f0c4Bb97554be067E",

  // Migration
  Migration_SfrxETHMarketProxy: "0x714B853b3bA73E439c652CfE79660F329E6ebB42",
  Migration_WstETHMarketProxy: "0xAD9A0E7C08bc9F747dF97a3E7E7f620632CB6155",

  // Other configurations
  GaugeRewarder: "0x5Ac1A882E6CeDc58511b7e42b02BAB42E2c02956", // for FxProtocol_FxUSDBasePoolGaugeProxy
  CRV_SN_USDC_fxUSD_193: "0x5018be882dcce5e3f2f3b0913ae2096b9b3fb61f",
  IRateProvider: "0x81A777c4aB65229d1Bf64DaE4c831bDf628Ccc7f",
  Convex_PoolRegistry: "0xdb95d646012bb87ac2e6cd63eab2c42323c1f5af",

  // fxSave
  FxSave_RewardHarvester: "0x0559a1b22409Eef7559a5c88cbaA4e285e7b9C30",
  FxSave_fxSAVE: "0x7743e50F534a7f9F1791DdE7dCD89F7783Eefc39",
  FxProtocol_FxUSDBasePoolGaugeProxy_FXN:
    "0x215D87bd3c7482E2348338815E059DE07Daf798A", // FxUSDBasePoolGaugeProxyV2
  FxSave_SavingFxUSDFacet: "0x56afB443dE36340c32f1a461605171992480059D",
  FxSave_FxUSDBasePoolV2Facet: "0xD36845bd3Ce4Ea0D60aEfa6a902eBfd23Cf44dF7",

  AaveV3StrategyUSDC: "0xd023Aac0e2D46c93d4c6e8e2A449bF2d4687804f",
  AaveV3StrategyWstETH: "0xFd3A6540e21D0E285f88FBFd904883B23e08F5C8",

  aaveUSDC: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
  aaveWstETH: "0xc035a7cf15375ce2706766804551791ad035e0c2",

  PositionAirdrop: "0x1359FcE197cf743016Cd1a620939a1A80Df259a5",

  // pool
  PoolManager: "0x250893CA4Ba5d05626C785e8da758026928FCD24",
  ShortPoolManager: "0xaCDc0AB51178d0Ae8F70c1EAd7d3cF5421FDd66D",

  // limit order
  LimitOrderManager: "0x112873b395B98287F3A4db266a58e2D01779Ad96",

  // fxETH token
  CreditNote_wstETH: "0x7c5350BaC0eB97F86A366Ee4F9619a560480F05A",
  // fxBTC
  CreditNote_WBTC: "0xB25a554033C59e33e48c5dc05A7192Fb1bbDdfc6",

  // fee, funding, etc. can be withdrawn here
  PoolConfiguration: "0x16b334f2644cc00b85DB1A1efF0C2C395e00C28d",

  WstETHLongPool: "0x6Ecfa38FeE8a5277B91eFdA204c235814F0122E8",
  WBTCLongPool: "0xAB709e26Fa6B0A30c119D8c55B887DeD24952473",
  WstETHShortPool: "0x25707b9e6690B52C60aE6744d711cf9C1dFC1876",
  WBTCShortPool: "0xA0cC8162c523998856D59065fAa254F87D20A5b0",

  // online
  PriceOracle_StETHPriceOracle: "0x0C5C61025f047cB7e3e85852dC8eAFd7b9a4Abfb",
  PriceOracle_WBTCPriceOracle: "0xb3c90e64EB6f456A5F5C17Aa99b6aecA6f4a6390",
  PriceOracle_InverseWstETHPriceOracle:
    "0x222786833b5fd5eE21532d8b576391bAbeFdAAd1",
  PriceOracle_InverseWBTCPriceOracle:
    "0x5d2c6215555B36889ef235c6d5cCDE22E9964e6a",

  // Check depeg, uppeg
  PriceOracle_FxUSDPriceOracle: "0x3eC677Ba393f2257ED0E1d37aA8442EB7F0953Fa",
};
