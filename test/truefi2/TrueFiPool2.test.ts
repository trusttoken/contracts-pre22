import { expect, use } from 'chai'
import {
  ImplementationReference,
  ImplementationReferenceFactory,
  LinearTrueDistributorFactory,
  LoanToken2Factory,
  MockErc20Token,
  MockErc20TokenFactory,
  MockStrategy,
  MockStrategyFactory,
  BadStrategy,
  BadStrategyFactory,
  PoolFactory,
  PoolFactoryFactory,
  StkTruTokenFactory,
  TrueFiPool2,
  TrueFiPool2Factory,
  TrueLender2,
  TrueLender2Factory,
  Pool2ArbitrageTestFactory,
} from 'contracts/types'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth } from 'utils/parseEth'
import { AddressZero } from '@ethersproject/constants'
import { DAY, timeTravel } from 'utils'
import { Deployer, setupDeploy } from 'scripts/utils'

use(solidity)

describe('TrueFiPool2', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let tusd: MockErc20Token
  let stakingToken: MockErc20Token
  let implementationReference: ImplementationReference
  let poolImplementation: TrueFiPool2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let lender: TrueLender2
  let deployContract: Deployer
  let poolStrategy1: MockStrategy
  let poolStrategy2: MockStrategy
  let badPoolStrategy: BadStrategy

  // const dayInSeconds = 60 * 60 * 24
  const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    deployContract = setupDeploy(owner)

    stakingToken = await deployContract(MockErc20TokenFactory)
    tusd = await deployContract(MockErc20TokenFactory)
    poolFactory = await deployContract(PoolFactoryFactory)
    poolImplementation = await deployContract(TrueFiPool2Factory)
    implementationReference = await deployContract(ImplementationReferenceFactory, poolImplementation.address)
    await poolFactory.initialize(implementationReference.address, stakingToken.address)
    await poolFactory.whitelist(tusd.address, true)
    await poolFactory.createPool(tusd.address)

    pool = poolImplementation.attach(await poolFactory.pool(tusd.address))

    const distributor = await deployContract(LinearTrueDistributorFactory)
    const stkToken = await deployContract(StkTruTokenFactory)
    await stkToken.initialize(stakingToken.address, pool.address, distributor.address, AddressZero)

    lender = await deployContract(TrueLender2Factory)
    await lender.initialize(stkToken.address, poolFactory.address)
    await pool.setLender(lender.address)
    await stkToken.setPayerWhitelistingStatus(lender.address, true)

    poolStrategy1 = await deployContract(MockStrategyFactory, tusd.address, pool.address)
    poolStrategy2 = await deployContract(MockStrategyFactory, tusd.address, pool.address)
    badPoolStrategy = await deployContract(BadStrategyFactory, tusd.address, pool.address)

    await tusd.mint(owner.address, includeFee(parseEth(1e7)))

    provider = _provider
  })

  const currencyBalanceOf = async (pool: TrueFiPool2) => (
    (await tusd.balanceOf(pool.address)).sub(await pool.claimableFees())
  )

  const withToleratedError = (number: BigNumber) => {
    const error = 2
    return number.mul(10000 - error * 100).div(10000)
  }

  describe('initializer', () => {
    it('sets corresponding token', async () => {
      expect(await pool.token()).to.equal(tusd.address)
    })

    it('sets staking token', async () => {
      expect(await pool.stakingToken()).to.eq(stakingToken.address)
    })

    it('sets no initial joiningFee', async () => {
      expect(await pool.joiningFee()).to.eq(0)
    })

    it('sets erc20 params', async () => {
      expect(await pool.name()).to.equal('TrueFi TrueUSD')
      expect(await pool.symbol()).to.equal('tfTUSD')
      expect(await pool.decimals()).to.equal(18)
    })

    it('transfers ownership', async () => {
      expect(await pool.owner()).to.eq(owner.address)
    })
  })

  it('cannot exit and join on same transaction', async () => {
    const arbitrage = await new Pool2ArbitrageTestFactory(owner).deploy()
    await tusd.transfer(arbitrage.address, parseEth(1))
    await expect(arbitrage.joinExit(pool.address)).to.be.revertedWith('TrueFiPool: Cannot join and exit in same block')
  })

  describe('changeJoiningPauseStatus', () => {
    it('can be called by owner', async () => {
      await expect(pool.changeJoiningPauseStatus(true))
        .not.to.be.reverted
      await expect(pool.changeJoiningPauseStatus(false))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(pool.connect(borrower).changeJoiningPauseStatus(true))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(pool.connect(borrower).changeJoiningPauseStatus(false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes pausing status', async () => {
      expect(await pool.isJoiningPaused()).to.be.false
      await pool.changeJoiningPauseStatus(true)
      expect(await pool.isJoiningPaused()).to.be.true
      await pool.changeJoiningPauseStatus(false)
      expect(await pool.isJoiningPaused()).to.be.false
    })

    it('emits proper event', async () => {
      await expect(pool.changeJoiningPauseStatus(true))
        .to.emit(pool, 'JoiningPauseStatusChanged')
        .withArgs(true)
      await expect(pool.changeJoiningPauseStatus(false))
        .to.emit(pool, 'JoiningPauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('poolValue', () => {
    const joinAmount = parseEth(1e7)

    beforeEach(async () => {
      await tusd.approve(pool.address, joinAmount)
      await pool.join(joinAmount)
    })

    describe('When pool has no strategy', () => {
      it('liquid value equals deposited amount', async () => {
        expect(await pool.liquidValue()).to.equal(joinAmount)
      })

      it('when no ongoing loans, pool value equals liquidValue', async () => {
        expect(await pool.poolValue()).to.equal(joinAmount)
      })

      it('when there are ongoing loans, pool value equals liquidValue + loanValue', async () => {
        const loan = await deployContract(
          LoanToken2Factory,
          pool.address,
          borrower.address,
          lender.address,
          AddressZero,
          500000,
          DAY,
          1000,
        )
        const fee = 1250
        await lender.connect(borrower).fund(loan.address)
        expect(await pool.liquidValue()).to.equal(joinAmount.sub(500000).add(fee))
        expect(await pool.loansValue()).to.equal(500000)
        expect(await pool.poolValue()).to.equal(joinAmount.add(fee))

        await timeTravel(provider, DAY * 2)
        expect(await pool.loansValue()).to.equal(500136)
        expect(await pool.poolValue()).to.equal(joinAmount.add(136).add(fee))
      })
    })
    // requires lender
  })

  describe('setJoiningFee', () => {
    it('sets fee value', async () => {
      await pool.setJoiningFee(50)
      expect(await pool.joiningFee()).to.equal(50)
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).setJoiningFee(50)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts when JoiningFee set to more than 100%', async () => {
      await expect(pool.setJoiningFee(10100))
        .to.be.revertedWith('TrueFiPool: Fee cannot exceed transaction value')
    })
  })

  describe('join-exit', () => {
    // requires strategy
    // requires lender
  })

  describe('liquidExit', () => {
    // requires strategy
    // requires lender
  })

  describe('integrateAtPoint', () => {
    const calcOffchain = (x: number) => Math.floor(Math.log(x + 50) * 50000)
    it('calculates integral * 1e9', async () => {
      for (let i = 0; i < 100; i++) {
        expect(await pool.integrateAtPoint(i)).to.equal(calcOffchain(i))
      }
    })
  })

  describe('averageExitPenalty', () => {
    const testPenalty = async (from: number, to: number, result: number) => expect(await pool.averageExitPenalty(from, to)).to.equal(result)

    it('throws if from > to', async () => {
      await expect(pool.averageExitPenalty(10, 9)).to.be.revertedWith('TrueFiPool: To precedes from')
    })

    it('correctly calculates penalty when from = to', async () => {
      await testPenalty(0, 0, 1000)
      await testPenalty(1, 1, 980)
      await testPenalty(100, 100, 333)
      await testPenalty(10000, 10000, 0)
    })

    it('correctly calculates penalty when from+1=to', async () => {
      const testWithStep1 = async (from: number) => {
        const penalty = await pool.averageExitPenalty(from, from + 1)
        const expected = (await pool.averageExitPenalty(from, from)).add(await pool.averageExitPenalty(from + 1, from + 1)).div(2)
        expect(penalty.sub(expected).abs()).to.be.lte(1)
      }

      await testWithStep1(0)
      await testWithStep1(1)
      await testWithStep1(2)
      await testWithStep1(3)
      await testWithStep1(5)
      await testWithStep1(10)
      await testWithStep1(42)
      await testWithStep1(150)
      await testWithStep1(1000)
      await testWithStep1(10000 - 2)
    })

    it('correctly calculates penalty when from < to', async () => {
      // Checked with Wolfram Alpha
      await testPenalty(0, 12, 896)
      await testPenalty(1, 100, 544)
      await testPenalty(5, 10, 870)
      await testPenalty(15, 55, 599)
      await testPenalty(42, 420, 215)
      await testPenalty(100, 1000, 108)
      await testPenalty(9100, 10000, 5)
      await testPenalty(1000, 10000, 12)
    })
  })

  describe('flush', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, includeFee(parseEth(100)))
      await pool.join(includeFee(parseEth(100)))
    })

    it('reverts when strategy is not set', async () => {
      await expect(pool.flush(100))
        .to.be.revertedWith('TrueFiPool: Pool has no strategy set up')
    })

    it('funds for deposit should go directly into strategy', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await badPoolStrategy.setErrorPercents(3)
      await expect(pool.flush(1000))
        .to.be.revertedWith('TrueFiPool: Strategy value expected to be higher')
      await badPoolStrategy.setErrorPercents(0)

      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      expect(await poolStrategy1.value()).to.eq(0)
      await expect(pool.flush(1000))
        .not.to.be.reverted
      expect(await poolStrategy1.value()).to.eq(1000)
    })

    it('emits event', async () => {
      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await expect(pool.flush(1000))
        .to.emit(pool, 'Flushed')
        .withArgs(1000)
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, includeFee(parseEth(100)))
      await pool.join(includeFee(parseEth(100)))
    })

    it('reverts when strategy is not set', async () => {
      await expect(pool.pull(100))
        .to.be.revertedWith('TrueFiPool: Pool has no strategy set up')
    })

    it('removed liquidity should get back to pool', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await pool.flush(1000)
      await badPoolStrategy.setErrorPercents(1)
      await expect(pool.pull(100))
        .to.be.revertedWith('TrueFiPool: Currency balance expected to be higher')
      await badPoolStrategy.setErrorPercents(0)

      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      const expectedCurrencyBalance = (await currencyBalanceOf(pool)).add(100)
      await expect(pool.pull(100))
        .not.to.be.reverted
      expect(await currencyBalanceOf(pool)).to.be.gte(expectedCurrencyBalance)
    })

    it('emits event', async () => {
      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      await expect(pool.pull(100))
        .to.emit(pool, 'Pulled')
        .withArgs(100)
    })
  })

  describe('borrow', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, includeFee(parseEth(100)))
      await pool.join(includeFee(parseEth(100)))
    })

    it('only lender can be caller', async () => {
      await expect(pool.connect(owner.address).borrow(0, 0))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender')
      const loan = await deployContract(
        LoanToken2Factory, pool.address, borrower.address,
        lender.address, AddressZero, 500000, DAY, 1000,
      )
      await expect(lender.connect(borrower).fund(loan.address))
        .not.to.be.reverted
    })

    it('in order to borrow from pool it has to have liquidity', async () => {
      let loan = await deployContract(
        LoanToken2Factory, pool.address,
        borrower.address, lender.address, AddressZero,
        (await tusd.balanceOf(pool.address)).add(1), DAY, 0,
      )
      await expect(lender.connect(borrower).fund(loan.address))
        .to.be.revertedWith('TrueFiPool: Insufficient liquidity')
      loan = await deployContract(
        LoanToken2Factory, pool.address, borrower.address,
        lender.address, AddressZero, 500000, DAY, 1000,
      )
      await expect(lender.connect(borrower).fund(loan.address))
        .not.to.be.reverted
    })

    describe('ensureSufficientLiquidity', () => {
      it('strategy has to return enouch funds', async () => {
        const loan = await deployContract(
          LoanToken2Factory, pool.address,
          borrower.address, lender.address, AddressZero,
          (await tusd.balanceOf(pool.address)), DAY, 0,
        )
        await pool.connect(owner).switchStrategy(badPoolStrategy.address)
        await pool.flush(1000)
        await badPoolStrategy.setErrorPercents(1)
        await expect(lender.connect(borrower).fund(loan.address))
          .to.be.revertedWith('TrueFiPool: Not enough funds taken from the strategy')
        await badPoolStrategy.setErrorPercents(0)
        await expect(lender.connect(borrower).fund(loan.address))
          .not.to.be.reverted
      })
    })
  })

  describe('repay', () => {
    // requires strategy
  })

  describe('collectFees', () => {
    const beneficiary = Wallet.createRandom().address

    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(1e7))
      await pool.setJoiningFee(25)
      await pool.join(parseEth(1e7))
    })

    it('transfers claimable fees to address', async () => {
      await pool.collectFees(beneficiary)
      expect(await tusd.balanceOf(beneficiary)).to.equal(parseEth(25000))
    })

    it('sets claimableFees to 0', async () => {
      await pool.collectFees(beneficiary)
      expect(await pool.claimableFees()).to.equal(0)
      await expect(pool.collectFees(beneficiary)).to.not.emit(tusd, 'Transfer')
    })

    it('reverts when called not by owner or funds manager', async () => {
      await expect(pool.connect(borrower).collectFees(beneficiary))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('switchStrategy', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, includeFee(parseEth(100)))
      await pool.join(includeFee(parseEth(100)))
    })

    it('only owner can switch strategy', async () => {
      await expect(pool.connect(borrower).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .not.to.be.reverted
    })

    it('cannot switch to the same strategy', async () => {
      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: Cannot switch to the same strategy')
      await expect(pool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
    })

    it('switches strategy', async () => {
      expect(await pool.strategy()).to.eq(AddressZero)
      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      expect(await pool.strategy()).to.eq(poolStrategy1.address)
      await pool.connect(owner).switchStrategy(poolStrategy2.address)
      expect(await pool.strategy()).to.eq(poolStrategy2.address)
    })

    it('all funds should be withdrawn to pool', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await pool.flush(1000)
      await badPoolStrategy.setErrorPercents(3)
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: All funds should be withdrawn to pool')
      await badPoolStrategy.setErrorPercents(0)

      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      const expectedMinCurrencyBalance = (await currencyBalanceOf(pool))
        .add(withToleratedError(await poolStrategy1.value()))
      await expect(pool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
      expect(await currencyBalanceOf(pool))
        .to.be.gte(expectedMinCurrencyBalance)
    })

    it('switched strategy should be depleted', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await pool.flush(1000)
      await badPoolStrategy.setErrorPercents(1)
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: Switched strategy should be depleted')
      await badPoolStrategy.setErrorPercents(0)

      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      await expect(pool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
      expect(await poolStrategy1.value()).to.eq(0)
    })

    it('emits event', async () => {
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.emit(pool, 'StrategySwitched')
        .withArgs(poolStrategy1.address)
    })
  })
})
