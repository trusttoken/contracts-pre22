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
const YEAR = 365 * DAY
const TRU_DECIMALS = 8

const deployParams = {
  mainnet: {
    DISTRIBUTION_DURATION: 2 * YEAR,
    DISTRIBUTION_START: 1629305911,
    STAKE_DISTRIBUTION_AMOUNT: utils.parseUnits('330000', TRU_DECIMALS).mul(2 * 365),
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
  const trustToken = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'

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
