import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  OwnedUpgradeabilityProxy,
  LinearTrueDistributor,
  TestTrustToken,
  TimeOwnedUpgradeabilityProxy,
  TrueMultiFarm,
  TrustToken,
} from '../build/artifacts'
import { utils, BigNumber } from 'ethers'

const TRU = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
const TFTUSD = '0x97cE06c3e3D027715b2d6C22e67D5096000072E5'
const TFUSDC = '0xA991356d261fbaF194463aF6DF8f0464F8f1c742'
const TFUSDT = '0x6002b1dcB26E7B1AA797A17551C6F487923299d7'
const MULTISIG = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'

const DAY = 60 * 60 * 24
const YEAR = 365 * DAY
const TRU_DECIMALS = 8

const deployParams = {
  mainnet: {
    DISTRIBUTION_DURATION: 2 * YEAR,
    DISTRIBUTION_START: 1629997200, // 2021/08/26 1100 PDT
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('282500', TRU_DECIMALS).mul(2 * 365), // 300k - 35k / 2
  },
  testnet: {
    DISTRIBUTION_DURATION: 2 * YEAR,
    DISTRIBUTION_START: Math.floor(Date.now() / 1000) + DAY,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('330000', TRU_DECIMALS).mul(2 * 365),
  },
}

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

  // Existing contracts
  const trustToken = isMainnet
    ? TRU
    : timeProxy(contract(TestTrustToken), () => {})

  // New contract impls
  const trueMultiFarm_LinearTrueDistributor_impl = contract('trueMultiFarm_LinearTrueDistributor', LinearTrueDistributor)
  const trueMultiFarm_impl = contract(TrueMultiFarm)

  // New contract proxies
  const trueMultiFarm_LinearTrueDistributor = proxy(trueMultiFarm_LinearTrueDistributor_impl, () => {})
  const trueMultiFarm = proxy(trueMultiFarm_impl, () => {})

  // New bare contracts
  // <None so far>

  // Contract initialization
  runIf(trueMultiFarm_LinearTrueDistributor.isInitialized().not(), () => {
    trueMultiFarm_LinearTrueDistributor.initialize(deployParams[NETWORK].DISTRIBUTION_START, deployParams[NETWORK].DISTRIBUTION_DURATION, deployParams[NETWORK].STAKE_DISTRIBUTION_AMOUNT, trustToken)
  })
  runIf(trueMultiFarm_LinearTrueDistributor.farm().equals(trueMultiFarm).not(), () => {
    trueMultiFarm_LinearTrueDistributor.setFarm(trueMultiFarm)
  })
  runIf(trueMultiFarm.isInitialized().not(), () => {
    trueMultiFarm.initialize(trueMultiFarm_LinearTrueDistributor)
  })
  trueMultiFarm.transferOwnership(MULTISIG)
  trueMultiFarm_LinearTrueDistributor.transferOwnership(MULTISIG)
  // TODO manually call these:
  // trueMultiFarm.transferProxyOwnership(MULTISIG)
  // trueMultiFarm_LinearTrueDistributor.transferProxyOwnership(MULTISIG)
  // trueMultiFarm.setShares([TFTUSD, TFUSDC, TFUSDT], [17_500, 170_000, 95_000])

  // TODO multisig call these:
  // trueMultiFarm.claimProxyOwnership()
  // trueMultiFarm_LinearTrueDistributor.claimProxyOwnership()
  // trueMultiFarm.claimOwnership()
})
