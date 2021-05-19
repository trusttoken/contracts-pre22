import { expect, use } from 'chai'
import {
  ImplementationReference,
  ImplementationReference__factory,
  LinearTrueDistributor__factory,
  LoanToken2,
  LoanToken2__factory,
  MockErc20Token,
  MockErc20Token__factory,
  MockStrategy,
  MockStrategy__factory,
  BadStrategy,
  BadStrategy__factory,
  PoolFactory,
  PoolFactory__factory,
  StkTruToken__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TrueLender2,
  TrueLender2__factory,
  Pool2ArbitrageTest__factory,
  StkTruToken,
} from 'contracts'
import {
  ITrueFiPoolOracleJson,
} from 'build'
import { deployMockContract, MockContract, MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth } from 'utils/parseEth'
import { AddressZero } from '@ethersproject/constants'
import { DAY, expectCloseTo, expectScaledCloseTo, parseTRU, timeTravel } from 'utils'
import { Deployer, setupDeploy } from 'scripts/utils'
import { TrueRatingAgencyV2Json } from 'build'

use(solidity)

describe('TrueFiPool2', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let tusd: MockErc20Token
  let stakingPool: StkTruToken
  let liquidationToken: MockErc20Token
  let implementationReference: ImplementationReference
  let poolImplementation: TrueFiPool2
  let pool: TrueFiPool2
  let poolFactory: PoolFactory
  let lender: TrueLender2
  let rater: MockContract
  let deployContract: Deployer
  let poolStrategy1: MockStrategy
  let poolStrategy2: MockStrategy
  let badPoolStrategy: BadStrategy

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    deployContract = setupDeploy(owner)

    stakingPool = await deployContract(StkTruToken__factory)
    liquidationToken = await deployContract(MockErc20Token__factory)
    tusd = await deployContract(MockErc20Token__factory)
    poolFactory = await deployContract(PoolFactory__factory)
    poolImplementation = await deployContract(TrueFiPool2__factory)
    implementationReference = await deployContract(ImplementationReference__factory, poolImplementation.address)
    lender = await deployContract(TrueLender2__factory)
    rater = await deployMockContract(owner, TrueRatingAgencyV2Json.abi)

    await poolFactory.initialize(implementationReference.address, liquidationToken.address, lender.address)
    await poolFactory.whitelist(tusd.address, true)
    await poolFactory.createPool(tusd.address)

    pool = poolImplementation.attach(await poolFactory.pool(tusd.address))

    const distributor = await deployContract(LinearTrueDistributor__factory)
    await stakingPool.initialize(stakingPool.address, pool.address, AddressZero, distributor.address, AddressZero)

    await lender.initialize(stakingPool.address, poolFactory.address, rater.address, AddressZero)
    await lender.setFee(0)
    await stakingPool.setPayerWhitelistingStatus(lender.address, true)

    poolStrategy1 = await deployContract(MockStrategy__factory, tusd.address, pool.address)
    poolStrategy2 = await deployContract(MockStrategy__factory, tusd.address, pool.address)
    badPoolStrategy = await deployContract(BadStrategy__factory, tusd.address, pool.address)

    await tusd.mint(owner.address, parseEth(1e7))

    provider = _provider
  })

  const currencyBalanceOf = async (pool: TrueFiPool2) => (
    (await tusd.balanceOf(pool.address)).sub(await pool.claimableFees())
  )

  const withToleratedSlippage = (number: BigNumber) => {
    const slippage = 1
    return number.mul(100 - slippage).div(100)
  }

  describe('initializer', () => {
    it('sets corresponding token', async () => {
      expect(await pool.token()).to.equal(tusd.address)
    })

    it('sets liquidation token', async () => {
      expect(await pool.liquidationToken()).to.eq(liquidationToken.address)
    })

    it('sets lender', async () => {
      expect(await pool.lender()).to.eq(lender.address)
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
    const arbitrage = await new Pool2ArbitrageTest__factory(owner).deploy()
    await tusd.transfer(arbitrage.address, parseEth(1))
    await expect(arbitrage.joinExit(pool.address)).to.be.revertedWith('TrueFiPool: Cannot join and exit in same block')
  })

  describe('setPauseStatus', () => {
    it('can be called by owner', async () => {
      await expect(pool.setPauseStatus(true))
        .not.to.be.reverted
      await expect(pool.setPauseStatus(false))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(pool.connect(borrower).setPauseStatus(true))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(pool.connect(borrower).setPauseStatus(false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes pausing status', async () => {
      expect(await pool.pauseStatus()).to.be.false
      await pool.setPauseStatus(true)
      expect(await pool.pauseStatus()).to.be.true
      await pool.setPauseStatus(false)
      expect(await pool.pauseStatus()).to.be.false
    })

    it('emits proper event', async () => {
      await expect(pool.setPauseStatus(true))
        .to.emit(pool, 'PauseStatusChanged')
        .withArgs(true)
      await expect(pool.setPauseStatus(false))
        .to.emit(pool, 'PauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('liquidValue', () => {
    const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

    beforeEach(async () => {
      await tusd.approve(pool.address, includeFee(parseEth(1e5)))
    })

    it('liquid value equals balanceOf(pool)', async () => {
      const depositedAmount = parseEth(1e5)
      await pool.join(depositedAmount)
      expect(await pool.liquidValue()).to.equal(depositedAmount)
      expect(await pool.liquidValue())
        .to.equal(await tusd.balanceOf(pool.address))
    })

    it('liquid value equals balanceOf(pool) - claimableFees', async () => {
      await pool.setJoiningFee(25)
      await pool.join(includeFee(parseEth(1e5)))
      expect(await pool.liquidValue())
        .to.equal(parseEth(1e5))
    })

    it('liquid value equals balanceOf(pool) - claimableFees + strategyValue', async () => {
      await pool.setJoiningFee(25)
      await pool.join(includeFee(parseEth(1e5)))
      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      expect(await pool.liquidValue())
        .to.equal((await currencyBalanceOf(pool)).add(1000))
    })
  })

  describe('strategyValue', () => {
    const joinAmount = parseEth(1e7)

    beforeEach(async () => {
      await tusd.approve(pool.address, joinAmount)
      await pool.join(joinAmount)
    })

    it('returns 0 if pool has no strategy', async () => {
      expect(await pool.strategyValue()).to.eq(0)
    })

    it('returns current strategy value', async () => {
      await pool.switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      expect(await pool.strategyValue()).to.eq(1000)
    })
  })

  describe('liquidationTokenValue', () => {
    it('returns 0 when pool holds no TRU', async () => {
      expect(await pool.liquidationTokenValue()).to.eq(0)
    })

    it('returns 0 when pool has no oracle', async () => {
      await liquidationToken.mint(pool.address, 1000)
      expect(await pool.liquidationTokenBalance()).to.eq(1000)
      expect(await pool.liquidationTokenValue()).to.eq(0)
    })

    it('converts TRU to pool token value using oracle and returns value - 1%', async () => {
      await liquidationToken.mint(pool.address, 1000)
      const mockOracle = await deployMockContract(owner, ITrueFiPoolOracleJson.abi)
      await mockOracle.mock.truToToken.returns(500)
      await pool.setOracle(mockOracle.address)
      expect(await pool.liquidationTokenValue()).to.eq(withToleratedSlippage(BigNumber.from(500)))
      expect('truToToken').to.be.calledOnContractWith(mockOracle, [1000])
    })

    xit('liquidationTokenValue is not part of liquidValue but a part of poolValue', async () => {
      await liquidationToken.mint(pool.address, 1000)
      const mockOracle = await deployMockContract(owner, ITrueFiPoolOracleJson.abi)
      await mockOracle.mock.truToToken.returns(500)
      await pool.setOracle(mockOracle.address)
      expect(await pool.liquidValue()).to.eq(0)
      expect(await pool.poolValue()).to.eq(withToleratedSlippage(BigNumber.from(500)))
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
          LoanToken2__factory,
          pool.address,
          borrower.address,
          lender.address,
          AddressZero,
          500000,
          DAY,
          1000,
        )
        await rater.mock.getResults.returns(0, 0, parseTRU(15e6))

        await lender.connect(borrower).fund(loan.address)
        expect(await pool.liquidValue()).to.equal(joinAmount.sub(500000))
        expect(await pool.loansValue()).to.equal(500000)
        expect(await pool.poolValue()).to.equal(joinAmount)

        await timeTravel(provider, DAY * 2)
        expect(await pool.loansValue()).to.equal(500136)
        expect(await pool.poolValue()).to.equal(joinAmount.add(136))
      })
    })
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

  describe('setOracle', () => {
    const oracle = Wallet.createRandom().address

    it('sets oracle', async () => {
      await pool.setOracle(oracle)
      expect(await pool.oracle()).to.equal(oracle)
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).setOracle(oracle))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('setBeneficiary', () => {
    it('sets beneficiary', async () => {
      await pool.setBeneficiary(owner.address)
      expect(await pool.beneficiary()).to.equal(owner.address)
    })

    it('reverts when called not by owner', async () => {
      await expect(pool.connect(borrower).setBeneficiary(owner.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to 0', async () => {
      await expect(pool.setBeneficiary(AddressZero))
        .to.be.revertedWith('TrueFiPool: Beneficiary address cannot be set to 0')
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(1e7))
      await pool.join(parseEth(1e7))
      await tusd.mint(borrower.address, parseEth(1e6))
      await tusd.connect(borrower).approve(pool.address, parseEth(1e6))
    })

    it('does not allow to join when joining is paused', async () => {
      await tusd.approve(pool.address, parseEth(1e6))
      await pool.setPauseStatus(true)
      await expect(pool.join(parseEth(1e6)))
        .to.be.revertedWith('TrueFiPool: Joining the pool is paused')
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await pool.balanceOf(owner.address)).to.equal(parseEth(1e7))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await deployContract(
        LoanToken2__factory,
        pool.address,
        borrower.address,
        lender.address,
        AddressZero,
        parseEth(1e6),
        DAY * 365,
        1000,
      )
      await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, DAY * 182.5)
      const totalSupply = await pool.totalSupply()
      const poolValue = await pool.poolValue()

      await pool.connect(borrower).join(parseEth(1e6))
      expectScaledCloseTo(await pool.balanceOf(borrower.address), totalSupply.mul(parseEth(1e6)).div(poolValue))
    })

    it('returns a basket of tokens on exit', async () => {
      const loan1 = await deployContract(
        LoanToken2__factory,
        pool.address,
        borrower.address,
        lender.address,
        AddressZero,
        parseEth(1e6),
        DAY * 365,
        1000,
      )
      await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(provider, DAY * 182.5)
      const loan2 = await deployContract(
        LoanToken2__factory,
        pool.address,
        borrower.address,
        lender.address,
        AddressZero,
        parseEth(1e6),
        DAY * 365,
        2500,
      )
      await lender.connect(borrower).fund(loan2.address)

      const liquidValue = await pool.liquidValue()
      const totalSupply = await pool.totalSupply()
      const exitAmount = totalSupply.div(2)

      await pool.exit(exitAmount)
      expect(await tusd.balanceOf(owner.address)).to.equal(exitAmount.mul(liquidValue).div(totalSupply))
      expectCloseTo(await loan1.balanceOf(owner.address), parseEth(55e4), 10)
      expectCloseTo(await loan2.balanceOf(owner.address), parseEth(625e3), 10)
    })

    describe('two stakers', () => {
      let loan1: LoanToken2, loan2: LoanToken2
      beforeEach(async () => {
        loan1 = await deployContract(
          LoanToken2__factory,
          pool.address,
          borrower.address,
          lender.address,
          AddressZero,
          parseEth(1e6),
          DAY * 365,
          1000,
        )
        await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
        await lender.connect(borrower).fund(loan1.address)
        await timeTravel(provider, DAY * 182.5)
        // PoolValue is 10.05M USD at the moment
        // After join, owner has around 91% of shares
        await pool.connect(borrower).join(parseEth(1e6))
        loan2 = await deployContract(
          LoanToken2__factory,
          pool.address,
          borrower.address,
          lender.address,
          AddressZero,
          parseEth(1e6),
          DAY * 365,
          2500,
        )
        await lender.connect(borrower).fund(loan2.address)
      })

      it('returns a basket of tokens on exit, two stakers', async () => {
        const liquidValue = await pool.liquidValue()
        const totalSupply = await pool.totalSupply()
        const exitAmount = totalSupply.div(2)

        await pool.exit(exitAmount)
        expect(await tusd.balanceOf(owner.address)).to.equal(exitAmount.mul(liquidValue).div(totalSupply))
        expectCloseTo(await loan1.balanceOf(owner.address), parseEth(55e4), 10)
        expectCloseTo(await loan2.balanceOf(owner.address), parseEth(625e3), 10)
      })

      it('erases all tokens after all stakers exit', async () => {
        const liquidValue = await pool.liquidValue()
        const totalSupply = await pool.totalSupply()
        const exitAmountBorrower = await pool.balanceOf(borrower.address)

        const exitAmountOwner = await pool.balanceOf(owner.address)

        await pool.exit(exitAmountOwner)
        await pool.connect(borrower).exit(exitAmountBorrower)

        expect(await tusd.balanceOf(pool.address)).to.equal(await pool.claimableFees())
        expect(await loan1.balanceOf(pool.address)).to.equal(0)
        expect(await loan2.balanceOf(pool.address)).to.equal(0)

        expectScaledCloseTo(await tusd.balanceOf(owner.address), exitAmountOwner.mul(liquidValue).div(totalSupply))
        expectScaledCloseTo(await loan1.balanceOf(owner.address), parseEth(11e5).mul(exitAmountOwner).div(totalSupply))
        expectScaledCloseTo(await loan2.balanceOf(owner.address), parseEth(125e4).mul(exitAmountOwner).div(totalSupply))

        expectScaledCloseTo(await tusd.balanceOf(borrower.address), exitAmountBorrower.mul(liquidValue).div(totalSupply))
        expectScaledCloseTo(await loan1.balanceOf(borrower.address), parseEth(11e5).mul(exitAmountBorrower).div(totalSupply))
        expectScaledCloseTo(await loan2.balanceOf(borrower.address), parseEth(125e4).mul(exitAmountBorrower).div(totalSupply))
      })
    })
  })

  describe('liquidExit', () => {
    const amount = parseEth(1e7)
    beforeEach(async () => {
      await tusd.approve(pool.address, amount)
      await pool.join(amount)
      await pool.switchStrategy(poolStrategy1.address)
    })

    it('burns pool tokens on exit', async () => {
      const supply = await pool.totalSupply()
      await pool.liquidExit(supply.div(2))
      expect(await pool.totalSupply()).to.equal(supply.div(2))
      await pool.liquidExit(supply.div(3))
      expect(await pool.totalSupply()).to.equal(supply.sub(supply.mul(5).div(6)))
    })

    it('all funds are liquid: transfers TUSD without penalty', async () => {
      await pool.liquidExit(await pool.balanceOf(owner.address))
      expect(await tusd.balanceOf(owner.address)).to.equal(amount)
    })

    it('all funds are liquid: transfers TUSD without penalty (half of stake)', async () => {
      await pool.liquidExit(amount.div(2))
      expect(await tusd.balanceOf(owner.address)).to.equal(amount.div(2))
    })

    it('after loan approved, applies a penalty', async () => {
      const loan1 = await deployContract(
        LoanToken2__factory,
        pool.address,
        borrower.address,
        lender.address,
        AddressZero,
        amount.div(3),
        DAY * 365,
        1000,
      )
      await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
      await lender.connect(borrower).fund(loan1.address)
      expect(await pool.liquidExitPenalty(amount.div(2))).to.equal(9990)
      await pool.liquidExit(amount.div(2), { gasLimit: 5000000 })
      expectScaledCloseTo(await tusd.balanceOf(owner.address), (amount.div(2).mul(9990).div(10000)))
    })

    it('half funds are in strategy: transfers TUSD without penalty', async () => {
      await pool.flush(parseEth(5e6))
      await pool.liquidExit(parseEth(6e6))
      expect(await tusd.balanceOf(owner.address)).to.equal(parseEth(6e6))
    })

    it('emits event', async () => {
      await expect(pool.liquidExit(amount.div(2))).to.emit(pool, 'Exited').withArgs(owner.address, amount.div(2))
    })
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
      await tusd.approve(pool.address, parseEth(100))
      await pool.join(parseEth(100))
    })

    it('reverts when strategy is not set', async () => {
      await expect(pool.flush(100))
        .to.be.revertedWith('TrueFiPool: Pool has no strategy set up')
    })

    it('funds for deposit should go directly into strategy', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await badPoolStrategy.setErrorPercents(500)
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
      await tusd.approve(pool.address, parseEth(100))
      await pool.join(parseEth(100))
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
      await tusd.approve(pool.address, parseEth(100))
      await pool.join(parseEth(100))
      await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
    })

    it('only lender can be caller', async () => {
      await expect(pool.connect(owner.address).borrow(0))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender')
      const loan = await deployContract(
        LoanToken2__factory, pool.address, borrower.address,
        lender.address, AddressZero, 500000, DAY, 1000,
      )
      await lender.connect(borrower).fund(loan.address)
      expect('borrow').to.be.calledOnContract(pool)
    })

    it('in order to borrow from pool it has to have liquidity', async () => {
      let loan = await deployContract(
        LoanToken2__factory, pool.address,
        borrower.address, lender.address, AddressZero,
        (await tusd.balanceOf(pool.address)).add(1), DAY, 0,
      )
      await expect(lender.connect(borrower).fund(loan.address))
        .to.be.revertedWith('TrueFiPool: Insufficient liquidity')
      loan = await deployContract(
        LoanToken2__factory, pool.address, borrower.address,
        lender.address, AddressZero, 500000, DAY, 1000,
      )
      await expect(lender.connect(borrower).fund(loan.address))
        .not.to.be.reverted
    })

    describe('ensureSufficientLiquidity', () => {
      it('strategy has to return enough funds', async () => {
        const loan = await deployContract(
          LoanToken2__factory, pool.address,
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
    let loan: LoanToken2

    const payBack = async (token: MockErc20Token, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
    }

    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(100))
      await pool.join(parseEth(100))
      await rater.mock.getResults.returns(0, 0, parseTRU(15e6))
      loan = await deployContract(
        LoanToken2__factory, pool.address, borrower.address,
        lender.address, AddressZero, 100000, DAY, 100,
      )
      await lender.connect(borrower).fund(loan.address)
      await payBack(tusd, loan)
      await loan.settle()
    })

    it('only lender can be caller', async () => {
      await expect(pool.connect(owner).repay(0))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender')
      await lender.reclaim(loan.address, '0x')
      expect('repay').to.be.calledOnContract(pool)
    })

    it('emits event', async () => {
      await expect(lender.reclaim(loan.address, '0x'))
        .to.emit(pool, 'Repaid')
        .withArgs(lender.address, 100002)
    })
  })

  describe('collectFees', () => {
    const beneficiary = Wallet.createRandom().address

    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(1e7))
      await pool.setJoiningFee(25)
      await pool.join(parseEth(1e7))
      await pool.setBeneficiary(beneficiary)
    })

    it('transfers claimable fees to address', async () => {
      await pool.collectFees()
      expect(await tusd.balanceOf(beneficiary)).to.equal(parseEth(25000))
    })

    it('sets claimableFees to 0', async () => {
      await pool.collectFees()
      expect(await pool.claimableFees()).to.equal(0)
      await expect(pool.collectFees()).to.not.emit(tusd, 'Transfer')
    })
  })

  describe('switchStrategy', () => {
    beforeEach(async () => {
      await tusd.approve(pool.address, parseEth(100))
      await pool.join(parseEth(100))
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
      await badPoolStrategy.setErrorPercents(500)
      await expect(pool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: All funds should be withdrawn to pool')
      await badPoolStrategy.setErrorPercents(0)

      await pool.connect(owner).switchStrategy(poolStrategy1.address)
      await pool.flush(1000)
      const expectedMinCurrencyBalance = (await currencyBalanceOf(pool))
        .add(withToleratedSlippage(await poolStrategy1.value()))
      await expect(pool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
      expect(await currencyBalanceOf(pool))
        .to.be.gte(expectedMinCurrencyBalance)
    })

    it('switched strategy should be depleted', async () => {
      await pool.connect(owner).switchStrategy(badPoolStrategy.address)
      await pool.flush(1000)
      await badPoolStrategy.setErrorPercents(5)
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
