import { expect, use } from 'chai'
import { LoanFactory2, LoanFactory2Factory, MockTrueCurrency, MockTrueCurrencyFactory, PoolFactory, PoolFactoryFactory, StkTruToken, StkTruTokenFactory, TrueLender2, TrueLender2Factory } from 'contracts/types'
import { Liquidator2 } from 'contracts/types/Liquidator2'
import { Liquidator2Factory } from 'contracts/types/Liquidator2Factory'
import { MockTrueFiPoolOracle } from 'contracts/types/MockTrueFiPoolOracle'
import { MockTrueFiPoolOracleFactory } from 'contracts/types/MockTrueFiPoolOracleFactory'
import { MockProvider, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { Deployer, setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'

use(solidity)

describe('Liquidator2', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let provider: MockProvider
  let owner: Wallet
  let deployContract: Deployer

  let liquidator: Liquidator2
  let loanFactory: LoanFactory2
  let poolFactory: PoolFactory
  let token: MockTrueCurrency
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let lender: TrueLender2
  let oracle: MockTrueFiPoolOracle

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    provider = _provider
    deployContract = setupDeploy(owner)

    liquidator = await deployContract(Liquidator2Factory)
    loanFactory = await deployContract(LoanFactory2Factory)
    poolFactory = await deployContract(PoolFactoryFactory)
    tru = await deployContract(MockTrueCurrencyFactory)
    stkTru = await deployContract(StkTruTokenFactory)
    lender = await deployContract(TrueLender2Factory)
    token = await deployContract(MockTrueCurrencyFactory)
    oracle = await deployContract(MockTrueFiPoolOracleFactory, token.address)

    await liquidator.initialize(poolFactory.address, stkTru.address, tru.address, oracle.address, loanFactory.address)
  })
  
  describe('Initializer', () => {
    it('sets poolFactory address correctly', async () => {
      expect(await liquidator.poolFactory()).to.equal(poolFactory.address)
    })

    it('sets stkTru address correctly', async () => {
      expect(await liquidator.stkTru()).to.equal(stkTru.address)
    })

    it('sets tru address correctly', async () => {
      expect(await liquidator.tru()).to.equal(tru.address)
    })

    it('sets oracle address correctly', async () => {
      expect(await liquidator.oracle()).to.equal(oracle.address)
    })

    it('sets loanFactory address correctly', async () => {
      expect(await liquidator.loanFactory()).to.equal(loanFactory.address)
    })

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
    })
  })
})
