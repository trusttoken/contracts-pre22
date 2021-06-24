import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  ChainlinkTruUsdcOracle__factory,
  CurveYearnStrategy__factory,
  Erc20Mock__factory, ImplementationReference,
  ImplementationReference__factory, OwnedProxyWithReference__factory,
  OwnedUpgradeabilityProxy__factory,
  PoolFactory__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'
import { AddressZero } from '@ethersproject/constants'
import { parseTRU } from 'utils'
import fetch from 'node-fetch'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueFiPool2', () => {
  const TRU_ADDRESS = '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784'
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const TRU_HOLDER = '0x23696914ca9737466d8553a2d619948f548ee424'
  const OWNER = '0x52bc44d5378309EE2abF1539BF71dE1b7d7bE3b5'
  const PROXY_OWNER = '0x16cea306506c387713c70b9c1205fd5ac997e78e'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, PROXY_OWNER, TRU_HOLDER])
  const owner = provider.getSigner(OWNER)
  const powner = provider.getSigner(PROXY_OWNER)
  const deployContract = setupDeploy(owner)

  let pool: TrueFiPool2
  let tru: TrustToken
  let implementationReference: ImplementationReference

  beforeEach(async () => {
    const poolFactory = await deployContract(PoolFactory__factory)
    const poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    tru = TrustToken__factory.connect(TRU_ADDRESS, owner)
    const lender = await deployContract(TrueLender2__factory)
    await lender.initialize(AddressZero, poolFactory.address, AddressZero, AddressZero)

    await poolFactory.initialize(implementationReference.address, tru.address, lender.address, AddressZero)
    await poolFactory.whitelist(USDC_ADDRESS, true)
    const usdc = Erc20Mock__factory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
    pool = TrueFiPool2__factory.connect(await poolFactory.pool(usdc.address), owner)
  })

  it('tether flush', async () => {
    const usdtPool = TrueFiPool2__factory.connect('0x6002b1dcb26e7b1aa797a17551c6f487923299d7', powner)
    const proxy = OwnedProxyWithReference__factory.connect('0x6002b1dcb26e7b1aa797a17551c6f487923299d7', powner)
    const strategyProxy = OwnedUpgradeabilityProxy__factory.connect('0x8D162Caa649e981E2a0b0ba5908A77f2536B11A8', powner)
    await proxy.changeImplementationReference(implementationReference.address)
    const newStrategy = await deployContract(CurveYearnStrategy__factory)
    await strategyProxy.upgradeTo(newStrategy.address)
    
    await expect(usdtPool.flush(10000000)).not.to.be.reverted
  })

  it('sell TRU on 1inch', async () => {
    const oracle = await deployContract(ChainlinkTruUsdcOracle__factory)
    await pool.setOracle(oracle.address)

    const holder = provider.getSigner(TRU_HOLDER)
    await tru.connect(holder).transfer(pool.address, parseTRU(100), {
      gasPrice: 0,
    })

    const dataUrl = `https://api.1inch.exchange/v3.0/1/swap?disableEstimate=true&protocols=UNISWAP_V2,SUSHI&allowPartialFill=false&fromTokenAddress=${TRU_ADDRESS}&toTokenAddress=${USDC_ADDRESS}&amount=${parseTRU(100)}&fromAddress=${pool.address}&slippage=2`
    const body = await (await fetch(dataUrl)).json()
    const data = body.tx.data
    expect(await pool.liquidValue()).to.eq(0)
    await pool.sellLiquidationToken(data)
    expect(await pool.liquidationTokenBalance()).to.equal(0)
    expect(await pool.poolValue()).to.be.gt(0)
    expect(await pool.liquidValue()).to.be.gt(0)
  })
})
