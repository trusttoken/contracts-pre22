import { expect, use } from 'chai'
import { beforeEachWithFixture, DAY, parseEth, parseTRU, timeTravel } from 'utils'
import { deployContract } from 'scripts/utils/deployContract'
import {
  ImplementationReference__factory,
  LoanToken2,
  LoanToken2__factory,
  MockErc20Token,
  MockErc20Token__factory,
  PoolFactory__factory,
  TrueFiPool2,
  TrueFiPool2__factory,
  TestTrueLender,
  TestTrueLender__factory,
  TrueRatingAgencyV2,
  TrueRatingAgencyV2__factory,
  PoolFactory,
  ArbitraryDistributor,
  TrustToken,
  TrustToken__factory,
  ArbitraryDistributor__factory,
  StkTruToken,
  StkTruToken__factory,
  LinearTrueDistributor__factory,
  MockTrueCurrency__factory,
  Mock1InchV3__factory,
  Mock1InchV3,
  LoanFactory2,
  LoanFactory2__factory,
  MockTrueFiPoolOracle,
  MockTrueFiPoolOracle__factory,
} from 'contracts'

import {
  Mock1InchV3Json,
  LoanToken2Json,
} from 'build'

import { deployMockContract, MockProvider, solidity } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { BigNumber, BigNumberish, utils, Wallet } from 'ethers'

use(solidity)

describe('TrueLender2', () => {
  let provider: MockProvider
  let owner: Wallet
  let borrower: Wallet

  let loanFactory: LoanFactory2
  let loan1: LoanToken2
  let loan2: LoanToken2
  let pool1: TrueFiPool2
  let pool2: TrueFiPool2
  let feePool: TrueFiPool2
  let poolOracle: MockTrueFiPoolOracle

  let rater: TrueRatingAgencyV2
  let arbitraryDistributor: ArbitraryDistributor
  let lender: TestTrueLender

  let counterfeitPool: TrueFiPool2
  let token1: MockErc20Token
  let token2: MockErc20Token

  let poolFactory: PoolFactory

  let stkTru: StkTruToken
  let tru: TrustToken
  let usdc: MockErc20Token
  let oneInch: Mock1InchV3

  const YEAR = DAY * 365

  const createLoan = async function (factory: LoanFactory2, creator: Wallet, pool: TrueFiPool2, amount: BigNumberish, duration: BigNumberish, apy: BigNumberish) {
    const loanTx = await factory.connect(creator).createLoanToken(pool.address, amount, duration, apy)
    const loanAddress = (await loanTx.wait()).events[0].args.contractAddress
    return new LoanToken2__factory(owner).attach(loanAddress)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, borrower] = wallets)
    poolFactory = await deployContract(owner, PoolFactory__factory)
    const poolImplementation = await deployContract(owner, TrueFiPool2__factory)
    const implementationReference = await deployContract(owner, ImplementationReference__factory, [poolImplementation.address])

    lender = await deployContract(owner, TestTrueLender__factory)
    await poolFactory.initialize(implementationReference.address, AddressZero, lender.address)

    stkTru = await deployContract(owner, StkTruToken__factory)

    tru = await deployContract(owner, TrustToken__factory)
    await tru.initialize()

    usdc = await deployContract(owner, MockErc20Token__factory)
    token1 = await deployContract(owner, MockErc20Token__factory)
    token2 = await deployContract(owner, MockErc20Token__factory)

    await poolFactory.whitelist(token1.address, true)
    await poolFactory.whitelist(token2.address, true)
    await poolFactory.whitelist(usdc.address, true)

    await poolFactory.createPool(token1.address)
    await poolFactory.createPool(token2.address)
    await poolFactory.createPool(usdc.address)

    pool1 = TrueFiPool2__factory.connect(await poolFactory.pool(token1.address), owner)
    pool2 = TrueFiPool2__factory.connect(await poolFactory.pool(token2.address), owner)
    counterfeitPool = await deployContract(owner, TrueFiPool2__factory)
    await counterfeitPool.initialize(token1.address, AddressZero, lender.address, AddressZero, owner.address)
    feePool = TrueFiPool2__factory.connect(await poolFactory.pool(usdc.address), owner)

    poolOracle = await deployContract(owner, MockTrueFiPoolOracle__factory, [token1.address])
    await pool1.setOracle(poolOracle.address)

    const tfusd = await deployContract(owner, MockTrueCurrency__factory) // just for testing, change this in origination fees development
    const trueDistributor = await deployContract(owner, LinearTrueDistributor__factory)
    await stkTru.initialize(tru.address, tfusd.address, tfusd.address, trueDistributor.address, AddressZero)

    rater = await deployContract(owner, TrueRatingAgencyV2__factory)
    oneInch = await new Mock1InchV3__factory(owner).deploy()
    await lender.initialize(stkTru.address, poolFactory.address, rater.address, oneInch.address)
    await lender.setFeePool(feePool.address)

    arbitraryDistributor = await deployContract(owner, ArbitraryDistributor__factory)
    await arbitraryDistributor.initialize(rater.address, tru.address, parseTRU(1e7))

    loanFactory = await deployContract(owner, LoanFactory2__factory)
    await loanFactory.initialize(poolFactory.address, lender.address, AddressZero)
    await rater.initialize(tru.address, stkTru.address, arbitraryDistributor.address, loanFactory.address)

    await token1.mint(owner.address, parseEth(1e7))
    await token2.mint(owner.address, parseEth(1e7))
    await token1.approve(pool1.address, parseEth(1e7))
    await token2.approve(pool2.address, parseEth(1e7))
    await pool1.join(parseEth(1e7))
    await pool2.join(parseEth(1e7))

    await rater.allowChangingAllowances(owner.address, true)
    await rater.allow(borrower.address, true)
    await tru.mint(owner.address, parseTRU(15e6))

    await tru.approve(stkTru.address, parseTRU(15e6))
    await stkTru.stake(parseTRU(15e6))
    await timeTravel(_provider, 1)

    loan1 = await createLoan(loanFactory, borrower, pool1, 100000, YEAR, 100)

    loan2 = await createLoan(loanFactory, borrower, pool2, 500000, YEAR, 1000)

    provider = _provider
  })

  const approveLoanRating = async function (loan: LoanToken2) {
    await rater.connect(borrower).submit(loan.address)
    await rater.yes(loan.address)

    await timeTravel(provider, 7 * DAY + 1)
  }

  describe('Initializer', () => {
    it('sets the staking pool address', async () => {
      expect(await lender.stakingPool()).to.equal(stkTru.address)
    })

    it('sets the pool factory address', async () => {
      expect(await lender.factory()).to.equal(poolFactory.address)
    })

    it('sets the rating agency address', async () => {
      expect(await lender.ratingAgency()).to.equal(rater.address)
    })

    it('default params', async () => {
      expect(await lender.minVotes()).to.equal(parseTRU(15e6))
      expect(await lender.minRatio()).to.equal(8000)
      expect(await lender.votingPeriod()).to.equal(DAY * 7)
      expect(await lender.maxLoans()).to.equal(100)
    })
  })

  describe('Parameters set up', () => {
    describe('setMinVotes', () => {
      it('changes minVotes', async () => {
        await lender.setMinVotes(1234)
        expect(await lender.minVotes()).to.equal(1234)
      })

      it('emits MinVotesChanged', async () => {
        await expect(lender.setMinVotes(1234))
          .to.emit(lender, 'MinVotesChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setMinVotes(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setMinRatio', () => {
      it('changes minRatio', async () => {
        await lender.setMinRatio(1234)
        expect(await lender.minRatio()).to.equal(1234)
      })

      it('forbids setting above 100%', async () => {
        await expect(lender.setMinRatio(10001))
          .to.be.revertedWith('TrueLender: minRatio cannot be more than 100%')
      })

      it('emits MinRatioChanged', async () => {
        await expect(lender.setMinRatio(1234))
          .to.emit(lender, 'MinRatioChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setMinRatio(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setFee', () => {
      it('changes fee', async () => {
        await lender.setFee(1234)
        expect(await lender.fee()).to.equal(1234)
      })

      it('forbids setting above 100%', async () => {
        await expect(lender.setFee(10001))
          .to.be.revertedWith('TrueLender: fee cannot be more than 100%')
      })

      it('emits FeeChanged', async () => {
        await expect(lender.setFee(1234))
          .to.emit(lender, 'FeeChanged').withArgs(1234)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setFee(1234)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setFeePool', () => {
      it('changes feePool', async () => {
        await lender.setFeePool(pool2.address)
        expect(await lender.feePool()).to.equal(pool2.address)
      })

      it('changes feeToken', async () => {
        await lender.setFeePool(pool2.address)
        expect(await lender.feeToken()).to.equal(token2.address)
      })

      it('emits FeePoolChanged', async () => {
        await expect(lender.setFeePool(pool2.address))
          .to.emit(lender, 'FeePoolChanged').withArgs(pool2.address)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setFeePool(pool2.address)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('setVotingPeriod', () => {
      it('changes votingPeriod', async () => {
        await lender.setVotingPeriod(DAY * 3)
        expect(await lender.votingPeriod()).to.equal(DAY * 3)
      })

      it('emits VotingPeriodChanged', async () => {
        await expect(lender.setVotingPeriod(DAY * 3))
          .to.emit(lender, 'VotingPeriodChanged').withArgs(DAY * 3)
      })

      it('must be called by owner', async () => {
        await expect(lender.connect(borrower).setVotingPeriod(DAY * 3)).to.be.revertedWith('caller is not the owner')
      })
    })

    describe('Setting loans limit', () => {
      it('reverts when performed by non-owner', async () => {
        await expect(lender.connect(borrower).setLoansLimit(0))
          .to.be.revertedWith('caller is not the owner')
      })

      it('changes loans limit', async () => {
        await lender.setLoansLimit(3)
        expect(await lender.maxLoans()).eq(3)
      })

      it('emits event', async () => {
        await expect(lender.setLoansLimit(2))
          .to.emit(lender, 'LoansLimitChanged')
          .withArgs(2)
      })
    })
  })

  describe('Funding', () => {
    describe('reverts if', () => {
      it('transaction not called by the borrower', async () => {
        await expect(lender.fund(loan1.address)).to.be.revertedWith('TrueLender: Sender is not borrower')
      })

      it('loan was created for unknown pool', async () => {
        const badLoan = await deployContract(owner, LoanToken2__factory, [
          counterfeitPool.address,
          borrower.address,
          lender.address,
          AddressZero,
          100000,
          DAY,
          100,
        ])
        await expect(lender.connect(borrower).fund(badLoan.address)).to.be.revertedWith('TrueLender: Pool not created by the factory')
      })

      it('there are too many loans for given pool', async () => {
        await lender.setLoansLimit(1)
        await approveLoanRating(loan1)
        await lender.connect(borrower).fund(loan1.address)
        await expect(lender.connect(borrower).fund(loan1.address)).to.be.revertedWith('TrueLender: Loans number has reached the limit')
      })

      it('loan was not long enough under voting', async () => {
        await rater.connect(borrower).submit(loan1.address)
        await rater.yes(loan1.address)
        await timeTravel(provider, 6 * DAY)

        await expect(lender.connect(borrower).fund(loan1.address))
          .to.be.revertedWith('TrueLender: Voting time is below minimum')
      })

      it('votes threshold has not been reached', async () => {
        await tru.mint(borrower.address, parseTRU(15e6))
        await tru.connect(borrower).approve(stkTru.address, parseTRU(15e6))
        await stkTru.connect(borrower).stake(parseTRU(14e6))
        await timeTravel(provider, 1)

        await rater.connect(borrower).submit(loan1.address)
        await rater.connect(borrower).yes(loan1.address)
        await timeTravel(provider, 7 * DAY + 1)

        await expect(lender.connect(borrower).fund(loan1.address))
          .to.be.revertedWith('TrueLender: Not enough votes given for the loan')
      })

      it('loan is predicted to be too risky', async () => {
        await rater.connect(borrower).submit(loan1.address)
        await rater.no(loan1.address)
        await timeTravel(provider, 7 * DAY + 1)

        await expect(lender.connect(borrower).fund(loan1.address))
          .to.be.revertedWith('TrueLender: Loan risk is too high')
      })
    })

    describe('all requirements are met', () => {
      beforeEach(async () => {
        await approveLoanRating(loan1)
      })

      it('borrows tokens from pool', async () => {
        const poolValueBefore = await pool1.liquidValue()
        const borrowedAmount = await loan1.amount()
        await lender.connect(borrower).fund(loan1.address)
        expect(poolValueBefore.sub(await pool1.liquidValue())).to.eq(borrowedAmount)
      })

      it('borrows receivedAmount from pool and transfers to the loan', async () => {
        await expect(lender.connect(borrower).fund(loan1.address))
          .to.emit(token1, 'Transfer')
          .withArgs(pool1.address, lender.address, 100000)
          .and.to.emit(token1, 'Transfer')
          .withArgs(lender.address, loan1.address, 100000)
        expect(await loan1.balance()).to.equal(100000)
      })

      it('emits event', async () => {
        await expect(lender.connect(borrower).fund(loan1.address))
          .to.emit(lender, 'Funded')
          .withArgs(pool1.address, loan1.address, 100000)
      })
    })

    describe('complex credibility cases', () => {
      interface LoanScenario {
        yesVotes: BigNumber,
        noVotes: BigNumber,
      }

      const scenario = (yes: number, no: number) => ({
        yesVotes: parseTRU(BigNumber.from(yes)),
        noVotes: parseTRU(BigNumber.from(no)),
      })

      const loanIsCredible = async (loanScenario: LoanScenario) => {
        return await lender.loanIsCredible(
          loanScenario.yesVotes,
          loanScenario.noVotes,
        ) && lender.votesThresholdReached(
          loanScenario.yesVotes.add(loanScenario.noVotes),
        )
      }

      describe('approvals', () => {
        const approvedLoanScenarios = [
          scenario(40e6, 10e6),
          scenario(12e6, 3e6),
        ]

        approvedLoanScenarios.forEach((loanScenario, index) => {
          it(`approved loan case #${index + 1}`, async () => {
            expect(await loanIsCredible(loanScenario)).to.be.true
          })
        })
      })

      describe('rejections', () => {
        const rejectedLoanScenarios = [
          scenario(40e6, 11e6),
          scenario(14e6, 9e5),
        ]

        rejectedLoanScenarios.forEach((loanScenario, index) => {
          it(`rejected loan case #${index + 1}`, async () => {
            expect(await loanIsCredible(loanScenario)).to.be.false
          })
        })
      })
    })
  })

  describe('value', () => {
    beforeEach(async () => {
      const newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

      await approveLoanRating(newLoan1)
      await approveLoanRating(loan1)
      await approveLoanRating(loan2)

      await lender.connect(borrower).fund(loan1.address)
      await lender.connect(borrower).fund(newLoan1.address)
      await lender.connect(borrower).fund(loan2.address)
    })

    it('shows correct value for a newly added loan', async () => {
      expect(await lender.value(pool1.address)).to.equal(200000)
      expect(await lender.value(pool2.address)).to.equal(500000)
    })

    it('value should increase with time', async () => {
      await timeTravel(provider, DAY / 2)
      expect(await lender.value(pool1.address)).to.equal(200002)
      expect(await lender.value(pool2.address)).to.equal(500068)
    })

    it('value stops increasing after term passes', async () => {
      await timeTravel(provider, YEAR)
      expect(await lender.value(pool1.address)).to.equal(201002)
      expect(await lender.value(pool2.address)).to.equal(550000)
      await timeTravel(provider, YEAR * 10)
      expect(await lender.value(pool1.address)).to.equal(201002)
      expect(await lender.value(pool2.address)).to.equal(550000)
    })
  })

  describe('Reclaiming', () => {
    const payBack = async (token: MockErc20Token, loan: LoanToken2) => {
      const balance = await loan.balance()
      const debt = await loan.debt()
      await token.mint(loan.address, debt.sub(balance))
    }

    beforeEach(async () => {
      await approveLoanRating(loan1)
      await lender.connect(borrower).fund(loan1.address)
      await lender.setFee(0)
    })

    it('works only for closed loans', async () => {
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.be.revertedWith('TrueLender: LoanToken is not closed yet')
    })

    it('reverts if loan has not been previously funded', async () => {
      const mockLoanToken = await deployMockContract(owner, LoanToken2Json.abi)
      await mockLoanToken.mock.status.returns(3)
      await mockLoanToken.mock.pool.returns(pool1.address)
      await expect(lender.reclaim(mockLoanToken.address, '0x'))
        .to.be.revertedWith('TrueLender: This loan has not been funded by the lender')
    })

    it('redeems funds from loan token', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(loan1.address, lender.address, 101000)
    })

    it('repays funds from the pool', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(token1, 'Transfer')
        .withArgs(lender.address, pool1.address, 101000)
    })

    it('defaulted loans can only be reclaimed by owner', async () => {
      await timeTravel(provider, YEAR * 2)
      await loan1.enterDefault()
      await expect(lender.connect(borrower).reclaim(loan1.address, '0x'))
        .to.be.revertedWith('TrueLender: Only owner can reclaim from defaulted loan')
    })

    it('emits a proper event', async () => {
      await payBack(token1, loan1)
      await loan1.settle()
      await expect(lender.reclaim(loan1.address, '0x'))
        .to.emit(lender, 'Reclaimed')
        .withArgs(pool1.address, loan1.address, 101000)
    })

    describe('Removes loan from array', () => {
      let newLoan1: LoanToken2
      beforeEach(async () => {
        await payBack(token1, loan1)
        await loan1.settle()

        newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

        await approveLoanRating(newLoan1)
        await approveLoanRating(loan2)

        await lender.connect(borrower).fund(newLoan1.address)
        await lender.connect(borrower).fund(loan2.address)
      })

      it('removes oldest loan from the array', async () => {
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(loan1.address, '0x')
        expect(await lender.loans(pool1.address)).to.deep.equal([newLoan1.address])
      })

      it('removes newest loan from the array', async () => {
        await payBack(token1, newLoan1)
        await newLoan1.settle()

        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address, newLoan1.address])
        await lender.reclaim(newLoan1.address, '0x')
        expect(await lender.loans(pool1.address)).to.deep.equal([loan1.address])
      })

      it('preserves loans for other pools', async () => {
        await lender.reclaim(loan1.address, '0x')
        expect(await lender.loans(pool2.address)).to.deep.equal([loan2.address])
      })
    })

    describe('With fees', () => {
      let fee: BigNumber
      let newLoan1: LoanToken2
      beforeEach(async () => {
        newLoan1 = await createLoan(loanFactory, borrower, pool1, parseEth(100000), YEAR, 100)
        await approveLoanRating(newLoan1)
        await lender.connect(borrower).fund(newLoan1.address)

        await lender.setFee(1000)
        await oneInch.setOutputAmount(parseEth(25))
        await payBack(token1, newLoan1)
        await newLoan1.settle()
        fee = (await newLoan1.debt()).sub(await newLoan1.amount()).div(10)
      })

      const encodeData = (fromToken: string, toToken: string, sender: string, receiver: string, amount: BigNumberish, flags = 0) => {
        const iface = new utils.Interface(Mock1InchV3Json.abi)
        return iface.encodeFunctionData('swap', [AddressZero, {
          srcToken: fromToken,
          dstToken: toToken,
          srcReceiver: sender,
          dstReceiver: receiver,
          amount: amount,
          minReturnAmount: 0,
          flags: flags,
          permit: '0x',
        }, '0x'])
      }

      it('swaps token for usdc', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await lender.reclaim(newLoan1.address, data)
      })

      it('fee is not sent to the pool', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data))
          .to.emit(token1, 'Transfer')
          .withArgs(lender.address, pool1.address, parseEth(101000).sub(fee))
      })

      it('reverts on wrong destination token', async () => {
        await token2.mint(lender.address, fee)
        const data = encodeData(token2.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Source token is not same as pool\'s token')
      })

      it('reverts when receiver is not lender', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, pool1.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Receiver is not lender')
      })

      it('reverts on wrong amount', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee.sub(1))
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Incorrect fee swap amount')
      })

      it('reverts if partial fill is allowed', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee, 1)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Partial fill is not allowed')
      })

      it('reverts if small USDC amount is returned', async () => {
        await oneInch.setOutputAmount(parseEth(24))
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data)).to.be.revertedWith('TrueLender: Fee returned from swap is too small')
      })

      it('puts fee into USDC pool and transfers LP tokens to stakers', async () => {
        const data = encodeData(token1.address, usdc.address, lender.address, lender.address, fee)
        await expect(lender.reclaim(newLoan1.address, data))
          .to.emit(feePool, 'Joined')
          .withArgs(lender.address, parseEth(25), parseEth(25))
          .and.to.emit(feePool, 'Transfer')
          .withArgs(lender.address, stkTru.address, parseEth(25))
      })
    })
  })

  describe('Distribute', () => {
    const loanTokens: LoanToken2[] = []

    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        const newLoan1 = await createLoan(loanFactory, borrower, pool1, 100000, DAY, 100)

        loanTokens.push(newLoan1)
        await approveLoanRating(newLoan1)
        await lender.connect(borrower).fund(newLoan1.address)
      }
    })

    it('sends all loan tokens in the same proportion as numerator/denominator', async () => {
      await expect(lender.testDistribute(borrower.address, 2, 5, pool1.address))
        .to.emit(loanTokens[0], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[1], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[2], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[3], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
        .and.to.emit(loanTokens[4], 'Transfer')
        .withArgs(lender.address, borrower.address, Math.floor(100002 * 2 / 5))
    })

    it('reverts if not called by the pool', async () => {
      await expect(lender.distribute(borrower.address, 2, 5)).to.be.revertedWith('TrueLender: Pool not created by the factory')
    })
  })
})
