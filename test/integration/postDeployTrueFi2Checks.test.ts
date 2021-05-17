import { expect } from 'chai'
import { providers } from 'ethers'
import {
  ImplementationReference__factory,
  Liquidator2__factory, LoanFactory2__factory,
  PoolFactory__factory, TrueFiPool__factory,
  TrueLender2__factory,
} from 'contracts'
import { DAY, parseTRU } from 'utils'
import { AddressZero } from '@ethersproject/constants'

// TODO fill addresses
const addresses = {
  owner: '',
  lender2: '',
  liquidator2: '',
  poolFactory: '',
  loanFactory2: '',
  implementationReference: '',
  poolImplementation: '',
  usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  tusd: '0x0000000000085d4780B73119b644AE5ecd22b376',
  ratingAgencyV2: '0x05461334340568075bE35438b221A3a0D261Fb6b',
  TRU: '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784',
  stkTRU: '0x23696914Ca9737466D8553a2d619948f548Ee424',
}

const loadContracts = (provider: providers.Provider) => {
  const poolFactory = PoolFactory__factory.connect(addresses.poolFactory, provider)
  const impRef = ImplementationReference__factory.connect(addresses.implementationReference, provider)
  const lender2 = TrueLender2__factory.connect(addresses.lender2, provider)
  const liquidator2 = Liquidator2__factory.connect(addresses.liquidator2, provider)
  const loanFactory2 = LoanFactory2__factory.connect(addresses.loanFactory2, provider)
  return [poolFactory, impRef, lender2, liquidator2, loanFactory2]
}

describe.skip('TrueFi2 deployment state', () => {
  describe('Setup', () => {
    const provider = new providers.AlchemyProvider('mainnet', 'Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl')
    const [poolFactory, impRef, lender2, liquidator2, loanFactory2] = loadContracts(provider)

    it('PoolFactory', async () => {
      expect(await poolFactory.liquidationToken()).to.equal(addresses.TRU)
      expect(await poolFactory.allowAll()).to.be.false
      expect(await poolFactory.poolImplementationReference()).to.equal(addresses.implementationReference)
      expect(await poolFactory.trueLender2()).to.equal(addresses.lender2)
      expect(await poolFactory.owner()).to.equal(addresses.owner)
    })

    it('ImplementationReference', async () => {
      expect(await impRef.owner()).to.equal(addresses.owner)
      expect(await impRef.implementation()).to.equal(addresses.poolImplementation)
    })

    it('TrueLender2', async () => {
      expect(await lender2.owner()).to.equal(addresses.owner)
      expect(await lender2.stakingPool()).to.equal(addresses.stkTRU)
      expect(await lender2.factory()).to.equal(addresses.poolFactory)
      expect(await lender2.ratingAgency()).to.equal(addresses.ratingAgencyV2)
      expect(await lender2._1inch()).to.equal(poolFactory.ONE_INCH_ADDRESS())
      expect(await lender2.minVotes()).to.equal(parseTRU(15_000_000))
      expect(await lender2.minRatio()).to.equal(1000)
      expect(await lender2.votingPeriod()).to.equal(7 * DAY)
      expect(await lender2.fee()).to.equal(1000)
      expect(await lender2.maxLoans()).to.equal(100)
      expect(await lender2.feeToken()).to.equal(addresses.usdc)
      expect(await lender2.feePool()).to.equal(await poolFactory.pool(addresses.usdc))
    })

    it('Liquidator2', async () => {
      expect(await liquidator2.owner()).to.equal(addresses.owner)
      expect(await liquidator2.stkTru()).to.equal(addresses.stkTRU)
      expect(await liquidator2.tru()).to.equal(addresses.TRU)
      expect(await liquidator2.loanFactory()).to.equal(addresses.loanFactory2)
      expect(await liquidator2.fetchMaxShare()).to.equal(1000)
    })

    it('LoanFactory2', async () => {
      expect(await loanFactory2.poolFactory()).to.equal(addresses.poolFactory)
      expect(await loanFactory2.lender()).to.equal(addresses.lender2)
      expect(await loanFactory2.liquidator()).to.equal(addresses.liquidator2)
    })

    it('Updated legacy pool', async () => {
      expect(await poolFactory.pool(addresses.tusd)).to.not.equal(AddressZero)
      const legacyPoolAddress = await poolFactory.pool(addresses.tusd)
      expect(await poolFactory.isPool(legacyPoolAddress)).to.be.true
      const legacyPool = TrueFiPool__factory.connect(legacyPoolAddress, provider)
      expect(await legacyPool._lender2()).to.equal(addresses.lender2)
    })
  })
})
