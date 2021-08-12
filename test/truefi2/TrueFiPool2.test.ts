import { expect, use } from 'chai'
import {
  LoanToken2,
  MockStrategy,
  MockStrategy__factory,
  BadStrategy,
  BadStrategy__factory,
  TrueFiPool2,
  TrueLender2,
  StkTruToken,
  MockTrueCurrency,
  TrueRatingAgencyV2,
  LoanFactory2,
  Safu,
  DeficiencyToken__factory,
  DeficiencyToken,
  TrueCreditAgency,
  TrueFiCreditOracle, TrueRateAdjuster,
} from 'contracts'
import { MockProvider, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth } from 'utils/parseEth'
import { AddressZero } from '@ethersproject/constants'
import { createApprovedLoan, DAY, expectScaledCloseTo, setupTruefi2, timeTravel as _timeTravel, YEAR } from 'utils'
import { Deployer, setupDeploy } from 'scripts/utils'
import { beforeEach } from 'mocha'

use(solidity)

describe('TrueFiPool2', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet
  let creditAgency: TrueCreditAgency
  let creditOracle: TrueFiCreditOracle
  let tusd: MockTrueCurrency
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let tusdPool: TrueFiPool2
  let usdcPool: TrueFiPool2
  let loanFactory: LoanFactory2
  let lender: TrueLender2
  let rater: TrueRatingAgencyV2
  let loan: LoanToken2
  let safu: Safu
  let deployContract: Deployer
  let poolStrategy1: MockStrategy
  let poolStrategy2: MockStrategy
  let badPoolStrategy: BadStrategy
  let rateAdjuster: TrueRateAdjuster

  let timeTravel: (time: number) => void

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    deployContract = setupDeploy(owner)
    timeTravel = (time: number) => _timeTravel(_provider, time)
    provider = _provider

    ;({ stkTru,
      tru,
      standardToken: tusd,
      rater,
      lender,
      standardPool: tusdPool,
      feePool: usdcPool,
      loanFactory,
      safu,
      creditAgency,
      creditOracle,
      rateAdjuster,
    } = await setupTruefi2(owner, provider))

    loan = await createApprovedLoan(rater, tru, stkTru, loanFactory, borrower, tusdPool, 500000, DAY, 1000, owner, provider)

    poolStrategy1 = await deployContract(MockStrategy__factory, tusd.address, tusdPool.address)
    poolStrategy2 = await deployContract(MockStrategy__factory, tusd.address, tusdPool.address)
    badPoolStrategy = await deployContract(BadStrategy__factory, tusd.address, tusdPool.address)

    await tusd.mint(owner.address, parseEth(1e7))

    await tusdPool.setCreditAgency(creditAgency.address)
    await creditAgency.allowPool(tusdPool.address, true)
    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
    await creditAgency.allowBorrower(borrower.address, YEAR * 10)
    await rateAdjuster.setRiskPremium(700)
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
      expect(await tusdPool.token()).to.equal(tusd.address)
    })

    it('sets lender', async () => {
      expect(await tusdPool.lender()).to.eq(lender.address)
    })

    it('sets no initial joiningFee', async () => {
      expect(await tusdPool.joiningFee()).to.eq(0)
    })

    it('sets erc20 params', async () => {
      expect(await tusdPool.name()).to.equal('TrueFi TrueCurrency')
      expect(await tusdPool.symbol()).to.equal('tfTCUR')
      expect(await tusdPool.decimals()).to.equal(18)
    })

    it('transfers ownership', async () => {
      expect(await tusdPool.owner()).to.eq(owner.address)
    })
  })

  describe('setPauseStatus', () => {
    it('can be called by owner', async () => {
      await expect(tusdPool.setPauseStatus(true))
        .not.to.be.reverted
      await expect(tusdPool.setPauseStatus(false))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(tusdPool.connect(borrower).setPauseStatus(true))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(tusdPool.connect(borrower).setPauseStatus(false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes pausing status', async () => {
      expect(await tusdPool.pauseStatus()).to.be.false
      await tusdPool.setPauseStatus(true)
      expect(await tusdPool.pauseStatus()).to.be.true
      await tusdPool.setPauseStatus(false)
      expect(await tusdPool.pauseStatus()).to.be.false
    })

    it('emits proper event', async () => {
      await expect(tusdPool.setPauseStatus(true))
        .to.emit(tusdPool, 'PauseStatusChanged')
        .withArgs(true)
      await expect(tusdPool.setPauseStatus(false))
        .to.emit(tusdPool, 'PauseStatusChanged')
        .withArgs(false)
    })
  })

  describe('setSAFU', () => {
    it('can be called by owner', async () => {
      await expect(tusdPool.setSafuAddress(borrower.address))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(tusdPool.connect(borrower).setSafuAddress(borrower.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes SAFU address', async () => {
      expect(await tusdPool.safu()).to.equal(safu.address)
      await tusdPool.setSafuAddress(borrower.address)
      expect(await tusdPool.safu()).to.equal(borrower.address)
    })

    it('emits proper event', async () => {
      await expect(tusdPool.setSafuAddress(borrower.address))
        .to.emit(tusdPool, 'SafuChanged')
        .withArgs(borrower.address)
    })
  })

  describe('setCreditAgency', () => {
    it('can be called by owner', async () => {
      await expect(tusdPool.setCreditAgency(creditAgency.address))
        .not.to.be.reverted
    })

    it('cannot be called by unauthorized address', async () => {
      await expect(tusdPool.connect(borrower).setCreditAgency(creditAgency.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('properly changes Credit Agency address', async () => {
      await tusdPool.setCreditAgency(AddressZero)
      expect(await tusdPool.creditAgency()).to.equal(AddressZero)
      await tusdPool.setCreditAgency(creditAgency.address)
      expect(await tusdPool.creditAgency()).to.equal(creditAgency.address)
    })

    it('emits proper event', async () => {
      await expect(tusdPool.setCreditAgency(creditAgency.address))
        .to.emit(tusdPool, 'CreditAgencyChanged')
        .withArgs(creditAgency.address)
    })
  })

  describe('liquidValue', () => {
    const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, includeFee(parseEth(1e5)))
    })

    it('liquid value equals balanceOf(pool)', async () => {
      const depositedAmount = parseEth(1e5)
      await tusdPool.join(depositedAmount)
      expect(await tusdPool.liquidValue()).to.equal(depositedAmount)
      expect(await tusdPool.liquidValue())
        .to.equal(await tusd.balanceOf(tusdPool.address))
    })

    it('liquid value equals balanceOf(pool) - claimableFees', async () => {
      await tusdPool.setJoiningFee(25)
      await tusdPool.join(includeFee(parseEth(1e5)))
      expect(await tusdPool.liquidValue())
        .to.equal(parseEth(1e5))
    })

    it('liquid value equals balanceOf(pool) - claimableFees + strategyValue', async () => {
      await tusdPool.setJoiningFee(25)
      await tusdPool.join(includeFee(parseEth(1e5)))
      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      expect(await tusdPool.liquidValue())
        .to.equal((await currencyBalanceOf(tusdPool)).add(1000))
    })
  })

  describe('strategyValue', () => {
    const joinAmount = parseEth(1e7)

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, joinAmount)
      await tusdPool.join(joinAmount)
    })

    it('returns 0 if pool has no strategy', async () => {
      expect(await tusdPool.strategyValue()).to.eq(0)
    })

    it('returns current strategy value', async () => {
      await tusdPool.switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      expect(await tusdPool.strategyValue()).to.eq(1000)
    })
  })

  describe('creditValue', () => {
    it('returns 0 if no creditAgency address set', async () => {
      await tusdPool.setCreditAgency(AddressZero)
      expect(await tusdPool.creditValue()).to.eq(0)
    })

    it('returns correct credit value', async () => {
      await tusd.approve(tusdPool.address, parseEth(1e7))
      await tusdPool.join(parseEth(1e7))

      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await tusdPool.creditValue()).to.be.closeTo(BigNumber.from(1000), 2)

      await timeTravel(YEAR)
      expect(await tusdPool.creditValue()).to.be.closeTo(BigNumber.from(1100), 2)
    })
  })

  describe('SAFU deficit', () => {
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(1e7))
      await tusdPool.join(parseEth(1e7))
      await lender.connect(borrower).fund(loan.address)
      await loan.connect(borrower).withdraw(borrower.address)
      await timeTravel(DAY * 4)
      await loan.enterDefault()
      await safu.liquidate(loan.address)
    })

    describe('deficitValue', () => {
      it('returns correct deficit value', async () => {
        expect(await tusdPool.deficitValue()).to.eq(500136)
      })

      it('returns 0 if no safu address set', async () => {
        await tusdPool.setSafuAddress(AddressZero)
        expect(await tusdPool.deficitValue()).to.eq(0)
      })

      it('returns 0 after loan has been repaid and redeemed', async () => {
        await tusd.mint(loan.address, 500136)
        await safu.redeem(loan.address)
        await tusdPool.reclaimDeficit(loan.address)
        expect(await tusdPool.deficitValue()).to.eq(0)
      })
    })

    describe('reclaimDeficit', () => {
      let dToken: DeficiencyToken

      beforeEach(async () => {
        await tusd.mint(loan.address, 500136)
        dToken = new DeficiencyToken__factory(owner).attach(await safu.deficiencyToken(loan.address))
        await safu.redeem(loan.address)
      })

      it('pool has deficiency tokens', async () => {
        expect(await dToken.balanceOf(tusdPool.address)).to.eq(500136)
      })

      it('transfers deficiency tokens to safu', async () => {
        await expect(() => tusdPool.reclaimDeficit(loan.address)).changeTokenBalance(dToken, tusdPool, -500136)
      })

      it('gets pool tokens from safu', async () => {
        await expect(() => tusdPool.reclaimDeficit(loan.address)).changeTokenBalance(tusd, tusdPool, 500136)
      })

      it('emits event', async () => {
        await expect(tusdPool.reclaimDeficit(loan.address))
          .to.emit(tusdPool, 'DeficitReclaimed')
          .withArgs(loan.address, 500136)
      })
    })
  })

  describe('poolValue', () => {
    const joinAmount = parseEth(1e7)

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, joinAmount)
      await tusdPool.join(joinAmount)
    })

    describe('When pool has no strategy', () => {
      it('liquid value equals deposited amount', async () => {
        expect(await tusdPool.liquidValue()).to.equal(joinAmount)
      })

      it('when no ongoing loans, pool value equals liquidValue', async () => {
        expect(await tusdPool.poolValue()).to.equal(joinAmount)
      })

      it('when there are ongoing loans, pool value equals liquidValue + loanValue', async () => {
        await lender.connect(borrower).fund(loan.address)
        expect(await tusdPool.liquidValue()).to.equal(joinAmount.sub(500000))
        expect(await tusdPool.loansValue()).to.equal(500000)
        expect(await tusdPool.poolValue()).to.equal(joinAmount)

        await timeTravel(DAY * 2)
        expect(await tusdPool.loansValue()).to.equal(500136)
        expect(await tusdPool.poolValue()).to.equal(joinAmount.add(136))
      })

      it('when pool has some deficiency value', async () => {
        await lender.connect(borrower).fund(loan.address)
        await loan.connect(borrower).withdraw(borrower.address)
        await timeTravel(DAY * 4)
        await loan.enterDefault()
        await safu.liquidate(loan.address)

        expect(await tusdPool.deficitValue()).to.eq(500136)
        expect(await expect(await tusdPool.poolValue()).to.equal(joinAmount.add(136)))
      })

      it('when pool has LoC opened', async () => {
        await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
        expect(await tusdPool.poolValue()).to.be.closeTo(joinAmount, 2)

        await timeTravel(YEAR)
        expect(await tusdPool.poolValue()).to.be.closeTo(joinAmount.add(100), 2)
      })
    })
  })

  describe('setJoiningFee', () => {
    it('sets fee value', async () => {
      await tusdPool.setJoiningFee(50)
      expect(await tusdPool.joiningFee()).to.equal(50)
    })

    it('reverts when called not by owner', async () => {
      await expect(tusdPool.connect(borrower).setJoiningFee(50)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('reverts when JoiningFee set to more than 100%', async () => {
      await expect(tusdPool.setJoiningFee(10100))
        .to.be.revertedWith('TrueFiPool: Fee cannot exceed transaction value')
    })
  })

  describe('setOracle', () => {
    const oracle = Wallet.createRandom().address

    it('sets oracle', async () => {
      await tusdPool.setOracle(oracle)
      expect(await tusdPool.oracle()).to.equal(oracle)
    })

    it('reverts when called not by owner', async () => {
      await expect(tusdPool.connect(borrower).setOracle(oracle))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('setBeneficiary', () => {
    it('sets beneficiary', async () => {
      await tusdPool.setBeneficiary(owner.address)
      expect(await tusdPool.beneficiary()).to.equal(owner.address)
    })

    it('reverts when called not by owner', async () => {
      await expect(tusdPool.connect(borrower).setBeneficiary(owner.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot be set to 0', async () => {
      await expect(tusdPool.setBeneficiary(AddressZero))
        .to.be.revertedWith('TrueFiPool: Beneficiary address cannot be set to 0')
    })
  })

  describe('join-exit', () => {
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(1e7))
      await tusdPool.join(parseEth(1e7))
      await tusd.mint(borrower.address, parseEth(1e6))
      await tusd.connect(borrower).approve(tusdPool.address, parseEth(1e6))
    })

    it('does not allow to join when joining is paused', async () => {
      await tusd.approve(tusdPool.address, parseEth(1e6))
      await tusdPool.setPauseStatus(true)
      await expect(tusdPool.join(parseEth(1e6)))
        .to.be.revertedWith('TrueFiPool: Joining the pool is paused')
    })

    it('mints liquidity tokens as 1-to-1 to TUSD for first user', async () => {
      expect(await tusdPool.balanceOf(owner.address)).to.equal(parseEth(1e7))
    })

    it('mints liquidity tokens proportionally to stake for next users', async () => {
      const loan1 = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        parseEth(1e6),
        DAY * 365,
        1000,
        owner,
        provider,
      )

      await lender.connect(borrower).fund(loan1.address)
      await timeTravel(DAY * 182.5)
      const totalSupply = await tusdPool.totalSupply()
      const poolValue = await tusdPool.poolValue()

      await tusdPool.connect(borrower).join(parseEth(1e6))
      expectScaledCloseTo(await tusdPool.balanceOf(borrower.address), totalSupply.mul(parseEth(1e6)).div(poolValue))
    })

    describe('two stakers', () => {
      let loan1: LoanToken2, loan2: LoanToken2
      beforeEach(async () => {
        loan1 = await createApprovedLoan(
          rater,
          tru,
          stkTru,
          loanFactory,
          borrower,
          tusdPool,
          parseEth(1e6),
          DAY * 365,
          1000,
          owner,
          provider,
        )

        await lender.connect(borrower).fund(loan1.address)
        await timeTravel(DAY * 182.5)
        // PoolValue is 10.05M USD at the moment
        // After join, owner has around 91% of shares
        await tusdPool.connect(borrower).join(parseEth(1e6))
        loan2 = await createApprovedLoan(
          rater,
          tru,
          stkTru,
          loanFactory,
          borrower,
          tusdPool,
          parseEth(1e6),
          DAY * 365,
          2500,
          owner,
          provider,
        )
        await lender.connect(borrower).fund(loan2.address)
      })
    })
  })

  describe('liquidExit', () => {
    const amount = parseEth(1e7)
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, amount)
      await tusdPool.join(amount)
      await tusdPool.switchStrategy(poolStrategy1.address)
    })

    it('burns pool tokens on exit', async () => {
      const supply = await tusdPool.totalSupply()
      await tusdPool.liquidExit(supply.div(2))
      expect(await tusdPool.totalSupply()).to.equal(supply.div(2))
      await tusdPool.liquidExit(supply.div(3))
      expect(await tusdPool.totalSupply()).to.equal(supply.sub(supply.mul(5).div(6)))
    })

    it('all funds are liquid: transfers TUSD without penalty', async () => {
      await tusdPool.liquidExit(await tusdPool.balanceOf(owner.address))
      expect(await tusd.balanceOf(owner.address)).to.equal(amount)
    })

    it('all funds are liquid: transfers TUSD without penalty (half of stake)', async () => {
      await tusdPool.liquidExit(amount.div(2))
      expect(await tusd.balanceOf(owner.address)).to.equal(amount.div(2))
    })

    it('after loan approved, applies a penalty', async () => {
      const loan1 = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        amount.div(3),
        DAY * 365,
        1000,
        owner,
        provider,
      )
      await lender.connect(borrower).fund(loan1.address)
      expect(await tusdPool.liquidExitPenalty(amount.div(2))).to.equal(9990)
      await tusdPool.liquidExit(amount.div(2), { gasLimit: 5000000 })
      expectScaledCloseTo(await tusd.balanceOf(owner.address), (amount.div(2).mul(9990).div(10000)))
    })

    it('half funds are in strategy: transfers TUSD without penalty', async () => {
      await tusdPool.flush(parseEth(5e6))
      await tusdPool.liquidExit(parseEth(6e6))
      expect(await tusd.balanceOf(owner.address)).to.equal(parseEth(6e6))
    })

    it('emits event', async () => {
      await expect(tusdPool.liquidExit(amount.div(2))).to.emit(tusdPool, 'Exited').withArgs(owner.address, amount.div(2))
    })
  })

  describe('integrateAtPoint', () => {
    const calcOffchain = (x: number) => Math.floor(Math.log(x + 50) * 50000)
    it('calculates integral * 1e9', async () => {
      for (let i = 0; i < 100; i++) {
        expect(await tusdPool.integrateAtPoint(i)).to.equal(calcOffchain(i))
      }
    })
  })

  describe('averageExitPenalty', () => {
    const testPenalty = async (from: number, to: number, result: number) => expect(await tusdPool.averageExitPenalty(from, to)).to.equal(result)

    it('throws if from > to', async () => {
      await expect(tusdPool.averageExitPenalty(10, 9)).to.be.revertedWith('TrueFiPool: To precedes from')
    })

    it('correctly calculates penalty when from = to', async () => {
      await testPenalty(0, 0, 1000)
      await testPenalty(1, 1, 980)
      await testPenalty(100, 100, 333)
      await testPenalty(10000, 10000, 0)
    })

    it('correctly calculates penalty when from+1=to', async () => {
      const testWithStep1 = async (from: number) => {
        const penalty = await tusdPool.averageExitPenalty(from, from + 1)
        const expected = (await tusdPool.averageExitPenalty(from, from)).add(await tusdPool.averageExitPenalty(from + 1, from + 1)).div(2)
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
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))
    })

    it('reverts when strategy is not set', async () => {
      await expect(tusdPool.flush(100))
        .to.be.revertedWith('TrueFiPool: Pool has no strategy set up')
    })

    it('funds for deposit should go directly into strategy', async () => {
      await tusdPool.connect(owner).switchStrategy(badPoolStrategy.address)
      await badPoolStrategy.setErrorPercents(500)
      await expect(tusdPool.flush(1000))
        .to.be.revertedWith('TrueFiPool: Strategy value expected to be higher')
      await badPoolStrategy.setErrorPercents(0)

      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      expect(await poolStrategy1.value()).to.eq(0)
      await expect(tusdPool.flush(1000))
        .not.to.be.reverted
      expect(await poolStrategy1.value()).to.eq(1000)
    })

    it('emits event', async () => {
      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await expect(tusdPool.flush(1000))
        .to.emit(tusdPool, 'Flushed')
        .withArgs(1000)
    })
  })

  describe('pull', () => {
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))
    })

    it('reverts when strategy is not set', async () => {
      await expect(tusdPool.pull(100))
        .to.be.revertedWith('TrueFiPool: Pool has no strategy set up')
    })

    it('removed liquidity should get back to pool', async () => {
      await tusdPool.connect(owner).switchStrategy(badPoolStrategy.address)
      await tusdPool.flush(1000)
      await badPoolStrategy.setErrorPercents(1)
      await expect(tusdPool.pull(100))
        .to.be.revertedWith('TrueFiPool: Currency balance expected to be higher')
      await badPoolStrategy.setErrorPercents(0)

      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      const expectedCurrencyBalance = (await currencyBalanceOf(tusdPool)).add(100)
      await expect(tusdPool.pull(100))
        .not.to.be.reverted
      expect(await currencyBalanceOf(tusdPool)).to.be.gte(expectedCurrencyBalance)
    })

    it('emits event', async () => {
      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      await expect(tusdPool.pull(100))
        .to.emit(tusdPool, 'Pulled')
        .withArgs(100)
    })
  })

  describe('borrow', () => {
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))
    })

    it('only lender and creditAgency can borrow from pool', async () => {
      await expect(tusdPool.connect(owner.address).borrow(0))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender or creditAgency')
    })

    it('lender can borrow funds', async () => {
      await lender.connect(borrower).fund(loan.address)
      expect('borrow').to.be.calledOnContract(tusdPool)
    })

    it('creditAgency can borrow funds', async () => {
      await tusdPool.setCreditAgency(borrower.address)
      await expect(tusdPool.connect(borrower).borrow(100)).to.be.not.reverted
    })

    it('in order to borrow from pool it has to have liquidity', async () => {
      const loan1 = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        (await tusd.balanceOf(tusdPool.address)).add(1),
        DAY,
        0,
        owner,
        provider,
      )

      await expect(lender.connect(borrower).fund(loan1.address))
        .to.be.revertedWith('TrueFiPool: Insufficient liquidity')

      const loan2 = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        500000,
        DAY,
        1000,
        owner,
        provider,
      )

      await expect(lender.connect(borrower).fund(loan2.address))
        .not.to.be.reverted
    })

    describe('ensureSufficientLiquidity', () => {
      it('strategy has to return enough funds', async () => {
        const loan = await createApprovedLoan(
          rater,
          tru,
          stkTru,
          loanFactory,
          borrower,
          tusdPool,
          (await tusd.balanceOf(tusdPool.address)),
          DAY,
          0,
          owner,
          provider,
        )
        await tusdPool.connect(owner).switchStrategy(badPoolStrategy.address)
        await tusdPool.flush(1000)
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

    const payBack = async (token: MockTrueCurrency, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
    }

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))

      loan = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        100000,
        DAY,
        0,
        owner,
        provider,
      )

      await lender.connect(borrower).fund(loan.address)
      await payBack(tusd, loan)
      await loan.settle()
    })

    it('only lender and creditAgency can repay to pool', async () => {
      await expect(tusdPool.connect(owner.address).repay(0))
        .to.be.revertedWith('TrueFiPool: Caller is not the lender or creditAgency')
    })

    it('lender can repay funds', async () => {
      await lender.reclaim(loan.address, '0x')
      expect('repay').to.be.calledOnContract(tusdPool)
    })

    it('creditAgency can repay funds', async () => {
      await tusdPool.setCreditAgency(borrower.address)
      await expect(tusdPool.connect(borrower).repay(0)).to.be.not.reverted
    })

    it('emits event', async () => {
      await expect(lender.reclaim(loan.address, '0x'))
        .to.emit(tusdPool, 'Repaid')
        .withArgs(lender.address, 100000)
    })
  })

  describe('collectFees', () => {
    const beneficiary = Wallet.createRandom().address

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(1e7))
      await tusdPool.setJoiningFee(25)
      await tusdPool.join(parseEth(1e7))
      await tusdPool.setBeneficiary(beneficiary)
    })

    it('transfers claimable fees to address', async () => {
      await tusdPool.collectFees()
      expect(await tusd.balanceOf(beneficiary)).to.equal(parseEth(25000))
    })

    it('sets claimableFees to 0', async () => {
      await tusdPool.collectFees()
      expect(await tusdPool.claimableFees()).to.equal(0)
      await expect(tusdPool.collectFees()).to.not.emit(tusd, 'Transfer')
    })
  })

  describe('switchStrategy', () => {
    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))
    })

    it('only owner can switch strategy', async () => {
      await expect(tusdPool.connect(borrower).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy1.address))
        .not.to.be.reverted
    })

    it('cannot switch to the same strategy', async () => {
      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: Cannot switch to the same strategy')
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
    })

    it('switches strategy', async () => {
      expect(await tusdPool.strategy()).to.eq(AddressZero)
      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      expect(await tusdPool.strategy()).to.eq(poolStrategy1.address)
      await tusdPool.connect(owner).switchStrategy(poolStrategy2.address)
      expect(await tusdPool.strategy()).to.eq(poolStrategy2.address)
    })

    it('all funds should be withdrawn to pool', async () => {
      await tusdPool.connect(owner).switchStrategy(badPoolStrategy.address)
      await tusdPool.flush(1000)
      await badPoolStrategy.setErrorPercents(500)
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: All funds should be withdrawn to pool')
      await badPoolStrategy.setErrorPercents(0)

      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      const expectedMinCurrencyBalance = (await currencyBalanceOf(tusdPool))
        .add(withToleratedSlippage(await poolStrategy1.value()))
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
      expect(await currencyBalanceOf(tusdPool))
        .to.be.gte(expectedMinCurrencyBalance)
    })

    it('switched strategy should be depleted', async () => {
      await tusdPool.connect(owner).switchStrategy(badPoolStrategy.address)
      await tusdPool.flush(1000)
      await badPoolStrategy.setErrorPercents(5)
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.be.revertedWith('TrueFiPool: Switched strategy should be depleted')
      await badPoolStrategy.setErrorPercents(0)

      await tusdPool.connect(owner).switchStrategy(poolStrategy1.address)
      await tusdPool.flush(1000)
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy2.address))
        .not.to.be.reverted
      expect(await poolStrategy1.value()).to.eq(0)
    })

    it('emits event', async () => {
      await expect(tusdPool.connect(owner).switchStrategy(poolStrategy1.address))
        .to.emit(tusdPool, 'StrategySwitched')
        .withArgs(poolStrategy1.address)
    })
  })

  describe('liquidate', () => {
    let loan: LoanToken2

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, parseEth(100))
      await tusdPool.join(parseEth(100))

      loan = await createApprovedLoan(
        rater,
        tru,
        stkTru,
        loanFactory,
        borrower,
        tusdPool,
        100000,
        DAY,
        100,
        owner,
        provider,
      )

      await lender.connect(borrower).fund(loan.address)
    })

    it('can only be performed by the SAFU', async () => {
      await expect(tusdPool.liquidate(loan.address)).to.be.revertedWith('TrueFiPool: Should be called by SAFU')
    })

    async function liquidate () {
      await timeTravel(DAY * 4)
      await loan.enterDefault()
      await safu.liquidate(loan.address)
    }

    it('transfers all LTs to the safu', async () => {
      await liquidate()
      expect(await loan.balanceOf(safu.address)).to.equal(await loan.totalSupply())
    })

    it('liquid exit after liquidation returns correct amount of tokens', async () => {
      await liquidate()
      const totalValue = await tusdPool.poolValue()
      const totalSupply = await tusdPool.totalSupply()
      const penalty = await tusdPool.liquidExitPenalty(totalSupply.div(2))
      expect(penalty).to.equal(9996)
      await expect(() => tusdPool.liquidExit(totalSupply.div(2))).to.changeTokenBalance(tusd, owner, totalValue.div(2).mul(penalty).div(10000))
    })
  })

  describe('utilization', () => {
    const includeFee = (amount: BigNumber) => amount.mul(10000).div(9975)

    beforeEach(async () => {
      await tusd.approve(tusdPool.address, includeFee(parseEth(1e5)))
    })

    it('utilization is 0%', async () => {
      const depositedAmount = parseEth(1e5)
      await tusdPool.join(depositedAmount)
      expect(await tusdPool.utilization()).to.eq(0)
    })

    it('utilization is 100%', async () => {
      await tusdPool.join(parseEth(1e5))
      const loanForWholePool = await createApprovedLoan(
        rater, tru,
        stkTru, loanFactory,
        borrower, tusdPool,
        parseEth(1e5), DAY,
        100, owner,
        provider,
      )
      await lender.connect(borrower).fund(loanForWholePool.address)
      expect(await tusdPool.utilization()).to.eq(100_00)
    })

    it('utilization is 50 %', async () => {
      await tusdPool.join(parseEth(1e5))
      const loanForPartOfPool = await createApprovedLoan(
        rater, tru,
        stkTru, loanFactory,
        borrower, tusdPool,
        parseEth(1e5).div(2), DAY,
        100, owner,
        provider,
      )
      await lender.connect(borrower).fund(loanForPartOfPool.address)
      expect(await tusdPool.utilization()).to.eq(50_00)
    })

    describe('liquidRatio', () => {
      beforeEach(async () => {
        await tusd.approve(tusdPool.address, includeFee(parseEth(1e5)))
        await tusdPool.join(parseEth(1e5))
        const loanForPartOfPool = await createApprovedLoan(
          rater, tru,
          stkTru, loanFactory,
          borrower, tusdPool,
          parseEth(1e5).div(4), DAY,
          100, owner,
          provider,
        )
        await lender.connect(borrower).fund(loanForPartOfPool.address)
      })

      it('returns 0 if poolValue is 0', async () => {
        expect(await usdcPool.liquidRatio()).to.eq(0)
      })

      it('equals 1 - utilization', async () => {
        const expected = 100_00 - (await tusdPool.utilization()).toNumber()
        expect(await tusdPool.liquidRatio()).to.eq(expected)
      })
    })
  })
})
