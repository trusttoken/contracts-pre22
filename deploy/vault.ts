import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  OwnedUpgradeabilityProxy,
  StkTruToken,
  TestTrustToken,
  TimeOwnedUpgradeabilityProxy,
  TrueFiVault,
} from '../build/artifacts'
import { utils, BigNumber } from 'ethers'

const BENEFICIARY = '0x0000000000000000000000000000000000000000'
const AMOUNT = utils.parseUnits('0', 8)

const TRU = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784'
const stkTRU = '0x23696914Ca9737466D8553a2d619948f548Ee424'

const OWNER_MULTISIG = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)
  const timeProxy = createProxy(TimeOwnedUpgradeabilityProxy)
  const isMainnet = config.network === 'mainnet'

  // Existing contracts
  const tru = isMainnet
    ? TRU
    : timeProxy(contract(TestTrustToken), () => { })
  const stkTruToken = isMainnet
    ? stkTRU
    : proxy(contract(StkTruToken), () => { })

  // New contract impls
  const trueFiVault_impl = contract(TrueFiVault)

  // New contract proxies
  const trueFiVault = proxy(trueFiVault_impl, () => { })

  // Contract initialization
  runIf(trueFiVault.isInitialized().not(), () => {
    // TODO tru.approve(trueFiVault, AMOUNT)
    trueFiVault.initialize(BENEFICIARY, AMOUNT, tru, stkTruToken)

    trueFiVault.transferOwnership(OWNER_MULTISIG)
    // TODO trueFiVault.transferProxyOwnership(OWNER_MULTISIG)

    // TODO trueFiVault.connect(multisig).claimOwnership()
    // TODO trueFiVault.connect(multisig).claimProxyOwnership()
  })
})
