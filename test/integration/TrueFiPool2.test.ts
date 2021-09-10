import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  CurveYearnStrategy__factory,
  Erc20Mock__factory, ImplementationReference,
  ImplementationReference__factory, OwnedProxyWithReference__factory,
  OwnedUpgradeabilityProxy__factory,
  PoolFactory__factory,
  TrueFiPool2__factory,
  TrueLender2__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueFiPool2', () => {
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const TFUSDT_ADDRESS = '0x6002b1dcb26e7b1aa797a17551c6f487923299d7'
  const TFUSDT_STRATEGY_ADDRESS = '0x8D162Caa649e981E2a0b0ba5908A77f2536B11A8'
  const TRU_HOLDER = '0x23696914ca9737466d8553a2d619948f548ee424'
  const OWNER = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5'
  const PROXY_OWNER = '0x16cea306506c387713c70b9c1205fd5ac997e78e'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, PROXY_OWNER, TRU_HOLDER])
  const owner = provider.getSigner(OWNER)
  const powner = provider.getSigner(PROXY_OWNER)
  const deployContract = setupDeploy(owner)

  let implementationReference: ImplementationReference

  beforeEach(async () => {
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    const lender = await deployContract(TrueLender2__factory)
    await lender.initialize(AddressZero, poolFactory.address, AddressZero, AddressZero, AddressZero, AddressZero)

    await poolFactory.initialize(implementationReference.address, lender.address, AddressZero, AddressZero)
    await poolFactory.allowToken(USDC_ADDRESS, true)
    const usdc = Erc20Mock__factory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
  })

  it('tether flush', async () => {
    const usdtPool = TrueFiPool2__factory.connect(TFUSDT_ADDRESS, powner)
    const proxy = OwnedProxyWithReference__factory.connect(TFUSDT_ADDRESS, powner)
    const strategyProxy = OwnedUpgradeabilityProxy__factory.connect(TFUSDT_STRATEGY_ADDRESS, powner)
    await proxy.changeImplementationReference(implementationReference.address)
    const newStrategy = await deployContract(CurveYearnStrategy__factory)
    await strategyProxy.upgradeTo(newStrategy.address)

    await expect(usdtPool.flush(10000000)).not.to.be.reverted
  })
})
