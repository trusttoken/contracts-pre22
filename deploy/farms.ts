// import { AddressLike, contract, createProxy, deploy } from 'ethereum-mars'
// import { LinearTrueDistributor, OwnedUpgradeabilityProxy, TrueFarm, TrueFiPool } from '../build/artifacts'
// import { utils } from 'ethers'
// import config from './config.json'
//
// const {contracts: {trustToken, liquidityTokens, nxm}, distributionStart} = config.mainnet
//
// const month = 60 * 60 * 24 * 30
//
// deploy({}, () => {
//   const deployDistributors = (params: [name: string, amount: number, duration: number][]) =>
//     Object.fromEntries(params.map(([name, amount, duration]) => [name, proxy(contract(`${name} Distributor`, LinearTrueDistributor), 'initialize', [
//       distributionStart, duration * month, utils.parseUnits(amount.toString(), 8), trustToken,
//     ])]))
//
//   const deployFarms = (params: [name: string, token: AddressLike][]) =>
//     Object.fromEntries(params.map(([name, token]) => [name, proxy(contract(`${name} Farm`, TrueFarm), 'initialize', [
//       token, distributions[name], name
//     ])]))
//
//   const proxy = createProxy(OwnedUpgradeabilityProxy)
//
//   const distributions = deployDistributors([
//     ['BAL BAL/TRU', 11310000, 1],
//     ['UNI ETH/TRU', 42412500, 4],
//     ['UNI TUSD/LP', 84825000, 12],
//     ['TrueFi LP', 169650000, 48],
//     ['NXM', 2827500, 1],
//   ])
//   // trueFiPool is expected to be deployed beforehand
//   const trueFiPool = proxy(contract(TrueFiPool), () => {})
//   deployFarms([
//     ['BAL BAL/TRU', liquidityTokens.balTruBal],
//     ['UNI ETH/TRU', liquidityTokens.ethTruUni],
//     ['UNI TUSD/LP', liquidityTokens.tusdLpUni],
//     ['TrueFi LP', trueFiPool],
//     ['NXM', nxm],
//   ])
// })
