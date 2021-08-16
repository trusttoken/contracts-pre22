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

const DAY = 60 * 60 * 24

const deployParams = {
  mainnet: {
    DISTRIBUTION_DURATION: 14 * DAY,
    DISTRIBUTION_START: 1623952800,
    // 200,000 per day for 14 days
    STAKE_DISTRIBUTION_AMOUNT: BigNumber.from('280000000000000'),
  },
  testnet: {
    DISTRIBUTION_DURATION: 180 * DAY,
    DISTRIBUTION_START: Date.parse('04/24/2021') / 1000,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('10', 8),
  },
}

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'
  const NETWORK = isMainnet ? 'mainnet' : 'testnet'

  // Existing contracts
  const trustToken = isMainnet
    ? timeProxy(contract(TrustToken), () => {})
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
})
