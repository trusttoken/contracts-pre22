import { expect, use } from 'chai'
import {
  BorrowingMutex__factory,
  Liquidator2,
  LoanFactory2,
  LoanToken2,
  LoanToken2__factory,
  MockTrueCurrency,
  MockUsdc,
  PoolFactory,
  StkTruToken,
  TrueFiPool2,
  TrueLender2,
  TrueFiCreditOracle,
  PoolFactory__factory,
} from 'contracts'

import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { DAY } from 'utils/constants'
import {
  beforeEachWithFixture,
  createLoan,
  parseEth,
  parseTRU,
  parseUSDC,
  setupTruefi2,
  timeTravel as _timeTravel,
} from 'utils'

use(solidity)

describe('Liquidator2', () => {
  enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

  let owner: Wallet
  let otherWallet: Wallet
  let assurance: Wallet
  let borrower: Wallet

  let liquidator: Liquidator2
  let loanFactory: LoanFactory2
  let poolFactory: PoolFactory
  let token: MockUsdc
  let tru: MockTrueCurrency
  let stkTru: StkTruToken
  let lender: TrueLender2
  let pool: TrueFiPool2
  let loan: LoanToken2
  let creditOracle: TrueFiCreditOracle

  let timeTravel: (time: number) => void

  const YEAR = DAY * 365
  const defaultedLoanCloseTime = YEAR + 3 * DAY

  const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
    loan.connect(wallet).withdraw(beneficiary)

  beforeEachWithFixture(async (_wallets, _provider) => {
    [owner, otherWallet, borrower, assurance] = _wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ; ({
      liquidator,
      loanFactory,
      poolFactory,
      feeToken: token,
      tru,
      stkTru,
      lender,
      feePool: pool,
      creditOracle,
    } = await setupTruefi2(owner, _provider))

    loan = await createLoan(loanFactory, borrower, pool, parseUSDC(1000), YEAR, 1000)

    await liquidator.setAssurance(assurance.address)

    await token.mint(owner.address, parseUSDC(1e7))
    await token.approve(pool.address, parseUSDC(1e7))

    await tru.mint(owner.address, parseEth(1e7))
    await tru.mint(otherWallet.address, parseEth(15e6))
    await tru.approve(stkTru.address, parseEth(1e7))
    await tru.connect(otherWallet).approve(stkTru.address, parseEth(1e7))

    await creditOracle.setScore(borrower.address, 255)
    await creditOracle.setMaxBorrowerLimit(borrower.address, parseEth(100_000_000))
  })

  describe('Initializer', () => {
    it('sets stkTru address correctly', async () => {
      expect(await liquidator.stkTru()).to.equal(stkTru.address)
    })

    it('sets tru address correctly', async () => {
      expect(await liquidator.tru()).to.equal(tru.address)
    })

    it('sets loanFactory address correctly', async () => {
      expect(await liquidator.loanFactory()).to.equal(loanFactory.address)
    })

    it('sets poolFactory address correctly', async () => {
      expect(await liquidator.poolFactory()).to.equal(poolFactory.address)
    })

    it('sets fetchMaxShare correctly', async () => {
      expect(await liquidator.fetchMaxShare()).to.equal(1000)
    })

    it('sets assurance correctly', async () => {
      expect(await liquidator.SAFU()).to.equal(assurance.address)
    })
  })

  describe('setPoolFactory', () => {
    let fakePoolFactory: PoolFactory
    beforeEach(async () => {
      fakePoolFactory = await new PoolFactory__factory(owner).deploy()
    })

    it('only owner', async () => {
      await expect(liquidator.connect(otherWallet).setPoolFactory(fakePoolFactory.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets new poolFactory address', async () => {
      await liquidator.setPoolFactory(fakePoolFactory.address)
      expect(await liquidator.poolFactory()).to.eq(fakePoolFactory.address)
    })
  })

  describe('setAssurance', () => {
    it('only owner', async () => {
      await expect(liquidator.connect(otherWallet).setAssurance(otherWallet.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets new assurance', async () => {
      await liquidator.setAssurance(owner.address)
      expect(await liquidator.SAFU()).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(liquidator.setAssurance(owner.address))
        .to.emit(liquidator, 'AssuranceChanged')
        .withArgs(owner.address)
    })
  })

  describe('fetchMaxShare', () => {
    it('only owner can set new share', async () => {
      await expect(liquidator.connect(otherWallet).setFetchMaxShare(500))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('cannot set share to 0', async () => {
      await expect(liquidator.setFetchMaxShare(0))
        .to.be.revertedWith('Liquidator: Share cannot be set to 0')
    })

    it('cannot set share to number larger than 10000', async () => {
      await expect(liquidator.setFetchMaxShare(10001))
        .to.be.revertedWith('Liquidator: Share cannot be larger than 10000')
    })

    it('is changed properly', async () => {
      await liquidator.setFetchMaxShare(500)
      expect(await liquidator.fetchMaxShare()).to.equal(500)
    })

    it('emits event', async () => {
      await expect(liquidator.setFetchMaxShare(500))
        .to.emit(liquidator, 'FetchMaxShareChanged')
        .withArgs(500)
    })
  })

  describe('liquidate', () => {
    beforeEach(async () => {
      await pool.connect(owner).join(parseUSDC(1e7))
      await lender.connect(borrower).fund(loan.address)
      await withdraw(borrower)
    })

    it('anyone can call it', async () => {
      await timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.connect(assurance).liquidate(loan.address))
        .to.not.be.reverted

      await expect(liquidator.connect(otherWallet).liquidate(loan.address))
        .to.be.revertedWith('Liquidator: Only SAFU contract can liquidate a loan')
    })

    describe('reverts if', () => {
      it('loan is not defaulted', async () => {
        await expect(liquidator.connect(assurance).liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')

        await timeTravel(defaultedLoanCloseTime)
        await expect(liquidator.connect(assurance).liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Loan must be defaulted')
      })

      it('loan was not created via factory', async () => {
        const deployContract = setupDeploy(owner)
        const borrowingMutex = await deployContract(BorrowingMutex__factory)
        await borrowingMutex.initialize()
        await borrowingMutex.allowLocker(owner.address, true)
        const fakeLoan = await deployContract(LoanToken2__factory)
        await fakeLoan.initialize(pool.address, borrowingMutex.address, borrower.address, borrower.address, owner.address, liquidator.address, parseUSDC(1000), YEAR, 1000)
        await token.connect(borrower).approve(fakeLoan.address, parseUSDC(1000))
        await fakeLoan.connect(borrower).fund()
        await borrowingMutex.lock(borrower.address, await fakeLoan.address)
        await timeTravel(defaultedLoanCloseTime)
        await fakeLoan.enterDefault()

        await expect(liquidator.connect(assurance).liquidate(fakeLoan.address))
          .to.be.revertedWith('Liquidator: Unknown loan')
      })

      it('pool is not supported', async () => {
        await poolFactory.unsupportPool(pool.address)
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
        await expect(liquidator.connect(assurance).liquidate(loan.address))
          .to.be.revertedWith('Liquidator: Pool not supported for default protection')
      })
    })

    it('changes loanToken status', async () => {
      await timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await liquidator.connect(assurance).liquidate(loan.address)
      expect(await loan.status()).to.equal(LoanTokenStatus.Liquidated)
    })

    describe('transfers correct amount of tru to assurance contract', () => {
      beforeEach(async () => {
        await timeTravel(defaultedLoanCloseTime)
        await loan.enterDefault()
      })

      it('0 tru in staking pool balance', async () => {
        await liquidator.connect(assurance).liquidate(loan.address)
        expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
      })

      it('returns max fetch share to assurance', async () => {
        await stkTru.stake(parseTRU(1e3))

        await liquidator.connect(assurance).liquidate(loan.address)
        expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(1e2))
      })

      it('returns defaulted value', async () => {
        await stkTru.stake(parseTRU(1e7))

        await liquidator.connect(assurance).liquidate(loan.address)
        expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(4400))
      })

      describe('only half of loan value has defaulted', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseUSDC(550))
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(22e2))
        })
      })

      describe('half of loan has defaulted and half redeemed', () => {
        beforeEach(async () => {
          await token.mint(loan.address, parseUSDC(550))
          await lender.reclaim(loan.address, '0x')
        })

        it('0 tru in staking pool balance', async () => {
          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(0))
        })

        it('returns max fetch share to assurance', async () => {
          await stkTru.stake(parseTRU(1e3))

          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(100))
        })

        it('returns defaulted value', async () => {
          await stkTru.stake(parseTRU(1e7))

          await liquidator.connect(assurance).liquidate(loan.address)
          expect(await tru.balanceOf(assurance.address)).to.equal(parseTRU(22e2))
        })
      })
    })

    it('emits event', async () => {
      await stkTru.stake(parseTRU(1e3))
      await timeTravel(defaultedLoanCloseTime)
      await loan.enterDefault()

      await expect(liquidator.connect(assurance).liquidate(loan.address))
        .to.emit(liquidator, 'Liquidated')
        .withArgs(loan.address, parseUSDC(1100), parseTRU(100))
    })
  })
})
