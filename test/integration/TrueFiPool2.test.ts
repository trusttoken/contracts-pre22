import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  CurveYearnStrategy__factory,
  Erc20Mock__factory, ImplementationReference,
  ImplementationReference__factory, OwnedProxyWithReference__factory,
  OwnedUpgradeabilityProxy__factory,
  PoolFactory__factory,
  TrueFiPool2__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseEth } from 'utils'

use(solidity)

describe('TrueFiPool2', () => {
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const TFUSDT_ADDRESS = '0x6002b1dcb26e7b1aa797a17551c6f487923299d7'
  const TFUSDT_STRATEGY_ADDRESS = '0x8D162Caa649e981E2a0b0ba5908A77f2536B11A8'
  const TRU_HOLDER = '0x23696914ca9737466d8553a2d619948f548ee424'
  const ETH_HOLDER = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const OWNER = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5'
  const PROXY_OWNER = '0x16cea306506c387713c70b9c1205fd5ac997e78e'
  const CONFIG_GNOSIS_SAFE = '0xf0aE09d3ABdF3641e2eB4cD45cf56873296a02CB'
  const DAO_TIMELOCK_CONTROLLER = '0x4f4AC7a7032A14243aEbDa98Ee04a5D7Fe293d07'
  const provider = forkChain([OWNER, PROXY_OWNER, CONFIG_GNOSIS_SAFE, TRU_HOLDER, ETH_HOLDER, DAO_TIMELOCK_CONTROLLER])
  const owner = provider.getSigner(OWNER)
  const powner = provider.getSigner(PROXY_OWNER)
  const configGnosis = provider.getSigner(CONFIG_GNOSIS_SAFE)
  const holder = provider.getSigner(ETH_HOLDER)
  const daoTimelockController = provider.getSigner(DAO_TIMELOCK_CONTROLLER)
  const deployContract = setupDeploy(owner)

  let implementationReference: ImplementationReference

  beforeEach(async () => {
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)

    await poolFactory.initialize(implementationReference.address, AddressZero, AddressZero, AddressZero)
    await poolFactory.allowToken(USDC_ADDRESS, true)
    const usdc = Erc20Mock__factory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
  })

  it('tether flush', async () => {
    const usdtPool = TrueFiPool2__factory.connect(TFUSDT_ADDRESS, powner)
    const proxy = OwnedProxyWithReference__factory.connect(TFUSDT_ADDRESS, daoTimelockController)
    await holder.sendTransaction({ value: parseEth(100), to: DAO_TIMELOCK_CONTROLLER })
    const strategyProxy = OwnedUpgradeabilityProxy__factory.connect(TFUSDT_STRATEGY_ADDRESS, powner)
    await proxy.changeImplementationReference(implementationReference.address)
    const newStrategy = await deployContract(CurveYearnStrategy__factory)
    await strategyProxy.upgradeTo(newStrategy.address)

    await holder.sendTransaction({ value: parseEth(100), to: CONFIG_GNOSIS_SAFE })
    await usdtPool.connect(configGnosis).switchStrategy(strategyProxy.address)

    await usdtPool.connect(configGnosis).switchStrategy(strategyProxy.address)
    await expect(usdtPool.connect(configGnosis).flush(10000000)).not.to.be.reverted
  })
})
