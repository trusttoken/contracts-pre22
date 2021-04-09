import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  GovernorAlpha,
  OwnedUpgradeabilityProxy,
  StkTruToken,
  TestTrustToken,
  Timelock,
  TimeOwnedUpgradeabilityProxy,
} from '../build/artifacts'

const TIMELOCK_DELAY = 10
const VOTING_PERIOD = 10

deploy({}, (deployer) => {
  const TIMELOCK_ADMIN = deployer
  const GOV_GUARDIAN = deployer

  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeOwnedProxy = createProxy(TimeOwnedUpgradeabilityProxy)

  // Existing contracts
  const stkTru = proxy(contract('stkTru', StkTruToken), () => {})

  // New contracts
  const tru = timeOwnedProxy(contract('testTru', TestTrustToken), 'initialize', [])
  const timelock = proxy(contract(Timelock), 'initialize', [TIMELOCK_ADMIN, TIMELOCK_DELAY])
  proxy(contract(GovernorAlpha), 'initialize', [timelock, tru, GOV_GUARDIAN, stkTru, VOTING_PERIOD])
})
