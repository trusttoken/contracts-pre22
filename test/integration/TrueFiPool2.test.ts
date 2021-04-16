import { forkChain } from './suite'
import { setupDeploy } from 'scripts/utils'
import {
  ChainlinkTruUsdcOracleFactory,
  Erc20MockFactory,
  ImplementationReferenceFactory,
  PoolFactoryFactory,
  TrueFiPool2,
  TrueFiPool2Factory,
  TrueLender2Factory,
  TrustToken,
  TrustTokenFactory,
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
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [OWNER, TRU_HOLDER])
  const owner = provider.getSigner(OWNER)
  const deployContract = setupDeploy(owner)

  let pool: TrueFiPool2
  let tru: TrustToken

  beforeEach(async () => {
    const poolFactory = await deployContract(PoolFactoryFactory)
    const poolImplementation = await deployContract(TrueFiPool2Factory)
    const implementationReference = await deployContract(ImplementationReferenceFactory, poolImplementation.address)
    tru = TrustTokenFactory.connect(TRU_ADDRESS, owner)
    const lender = await deployContract(TrueLender2Factory)
    await lender.initialize(AddressZero, poolFactory.address, AddressZero, AddressZero)

    await poolFactory.initialize(implementationReference.address, tru.address, lender.address)
    await poolFactory.whitelist(USDC_ADDRESS, true)
    const usdc = Erc20MockFactory.connect(USDC_ADDRESS, owner)
    await poolFactory.createPool(usdc.address)
    pool = TrueFiPool2Factory.connect(await poolFactory.pool(usdc.address), owner)
  })

  it('sell TRU on 1inch', async () => {
    const oracle = await deployContract(ChainlinkTruUsdcOracleFactory)
    await pool.setOracle(oracle.address)

    const holder = provider.getSigner(TRU_HOLDER)
    await tru.connect(holder).transfer(pool.address, parseTRU(100), {
      gasPrice: 0,
    })

    const dataUrl = `https://api.1inch.exchange/v3.0/1/swap?disableEstimate=true&protocols=WETH,CURVE,BALANCER,UNISWAP_V2,SUSHI,ZRX&allowPartialFill=false&fromTokenAddress=${TRU_ADDRESS}&toTokenAddress=${USDC_ADDRESS}&amount=${parseTRU(100)}&fromAddress=${pool.address}&slippage=2`
    const body = await (await fetch(dataUrl)).json()
    const data = body.tx.data
    expect(await pool.liquidValue()).to.eq(0)
    await pool.sellLiquidationToken(data)
    expect(await pool.liquidationTokenBalance()).to.equal(0)
    expect(await pool.poolValue()).to.be.gt(0)
    expect(await pool.liquidValue()).to.be.gt(0)
  })
})
