// import { contract, createProxy, deploy } from 'ethereum-mars'
// import {
//   LinearTrueDistributor,
//   LoanFactory,
//   OwnedUpgradeabilityProxy,
//   TrueFiPool, TrueLender,
//   TrueRatingAgency,
// } from '../build/artifacts'
// import config from './config.json'
// import { utils } from 'ethers'
//
// const { contracts: { tusd, trustToken, curve, uniswapRouter }, distributionStart } = config.mainnet
//
// const month = 60 * 60 * 24 * 30
//
// deploy({}, () => {
//   const proxy = createProxy(OwnedUpgradeabilityProxy)
//   const loanFactory = proxy(contract(LoanFactory), 'initialize', [tusd])
//   const votersDistributor = proxy(contract('TRU Voters Distributor', LinearTrueDistributor), 'initialize', [
//     distributionStart, 48 * month, utils.parseUnits('254475000', 8), trustToken,
//   ])
//   const trueRatingAgency = proxy(contract(TrueRatingAgency), 'initialize', [trustToken, votersDistributor, loanFactory])
//   const trueLender = proxy(contract(TrueLender), () => {})
//   const trueFiPool = proxy(contract(TrueFiPool), 'initialize', [curve.pool, curve.yGauge, tusd, trueLender, uniswapRouter])
//
//   // FIXME This will revert if True Lender was initialized before
//   // TODO when Mars gets conditional transactions, use them
//   trueLender.initialize(trueFiPool, trueRatingAgency)
// })
