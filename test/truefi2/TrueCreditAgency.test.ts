import { BigNumber, Wallet } from 'ethers'
import {
  MockTrueCurrency,
  TrueCreditAgency,
  TrueCreditAgency__factory,
  TrueFiCreditOracle,
  TrueFiCreditOracle__factory,
  TrueFiPool2,
} from 'contracts'
import { beforeEachWithFixture, parseEth, setupTruefi2, timeTravel as _timeTravel, YEAR } from 'utils'
import { expect } from 'chai'
import { AddressZero } from '@ethersproject/constants'

describe('TrueCreditAgency', () => {
  let owner: Wallet
  let borrower: Wallet
  let creditAgency: TrueCreditAgency
  let tusd: MockTrueCurrency
  let tusdPool: TrueFiPool2
  let creditOracle: TrueFiCreditOracle
  let timeTravel: (time: number) => void

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower] = wallets
    timeTravel = (time: number) => _timeTravel(_provider, time)

    ;({
      standardToken: tusd,
      standardPool: tusdPool,
    } = await setupTruefi2(owner))

    await tusd.mint(owner.address, parseEth(1e7))
    await tusd.approve(tusdPool.address, parseEth(1e7))
    await tusdPool.join(parseEth(1e7))

    creditOracle = await new TrueFiCreditOracle__factory(owner).deploy()
    await creditOracle.initialize()
    await creditOracle.setManager(owner.address)

    creditAgency = await new TrueCreditAgency__factory(owner).deploy()
    await creditAgency.initialize(creditOracle.address, 100)

    await tusdPool.setCreditAgency(creditAgency.address)
    await creditAgency.allowPool(tusdPool.address, true)

    await creditOracle.setScore(borrower.address, 255)
  })

  describe('initializer', () => {
    it('sets riskPremium', async () => {
      expect(await creditAgency.riskPremium()).to.eq(100)
    })

    it('sets creditOracle', async () => {
      expect(await creditAgency.creditOracle()).to.equal(creditOracle.address)
    })
  })

  describe('Ownership', () => {
    it('owner is set to msg.sender of initialize()', async () => {
      expect(await creditAgency.owner()).to.equal(owner.address)
    })

    it('ownership transfer', async () => {
      await creditAgency.transferOwnership(borrower.address)
      expect(await creditAgency.owner()).to.equal(owner.address)
      expect(await creditAgency.pendingOwner()).to.equal(borrower.address)
      await creditAgency.connect(borrower).claimOwnership()
      expect(await creditAgency.owner()).to.equal(borrower.address)
      expect(await creditAgency.pendingOwner()).to.equal(AddressZero)
    })
  })

  describe('setRiskPremium', () => {
    it('reverts if not called by the owner', async () => {
      await expect(creditAgency.connect(borrower).setRiskPremium(1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes riskPremium rate', async () => {
      await creditAgency.setRiskPremium(1)
      expect(await creditAgency.riskPremium()).to.eq(1)
    })

    it('emits event', async () => {
      await expect(creditAgency.setRiskPremium(1))
        .to.emit(creditAgency, 'RiskPremiumChanged')
        .withArgs(1)
    })
  })

  describe('Borrower allowance', () => {
    it('only owner can set allowance', async () => {
      await expect(creditAgency.connect(borrower).allowBorrower(borrower.address, true))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('allowance is properly set', async () => {
      expect(await creditAgency.isBorrowerAllowed(borrower.address)).to.equal(false)
      await creditAgency.allowBorrower(borrower.address, true)
      expect(await creditAgency.isBorrowerAllowed(borrower.address)).to.equal(true)
      await creditAgency.allowBorrower(borrower.address, false)
      expect(await creditAgency.isBorrowerAllowed(borrower.address)).to.equal(false)
    })

    it('emits a proper event', async () => {
      await expect(creditAgency.allowBorrower(borrower.address, true))
        .to.emit(creditAgency, 'BorrowerAllowed')
        .withArgs(borrower.address, true)
      await expect(creditAgency.allowBorrower(borrower.address, false))
        .to.emit(creditAgency, 'BorrowerAllowed')
        .withArgs(borrower.address, false)
    })
  })

  describe('Setting pool allowance', () => {
    it('can only be called by the owner', async () => {
      await expect(creditAgency.connect(borrower).allowPool(tusdPool.address, true)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('changes pool allowance status', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.false
      await creditAgency.allowPool(tusdPool.address, true)
      expect(await creditAgency.isPoolAllowed(tusdPool.address)).to.be.true
    })

    it('emits event', async () => {
      await expect(creditAgency.allowPool(tusdPool.address, false)).to.emit(creditAgency, 'PoolAllowed')
        .withArgs(tusdPool.address, false)
    })
  })

  describe('Borrowing', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
    })

    it('borrows funds from the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(1000)
    })

    it('fails if borrower is not whitelisted', async () => {
      await creditAgency.allowBorrower(borrower.address, false)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: Sender is not allowed to borrow')
    })

    it('cannot borrow from the pool that is not whitelisted', async () => {
      await creditAgency.allowPool(tusdPool.address, false)
      await expect(creditAgency.connect(borrower).borrow(tusdPool.address, 1000))
        .to.be.revertedWith('TrueCreditAgency: The pool is not whitelisted for borrowing')
    })

    it('correctly handles the case when credit score is changing', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.creditScore(tusdPool.address, borrower.address)).to.equal(255)
      expect((await creditAgency.buckets(tusdPool.address, 255)).totalBorrowed).to.equal(1000)
      expect((await creditAgency.buckets(tusdPool.address, 255)).borrowersCount).to.equal(1)

      await creditOracle.setScore(borrower.address, 200)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      expect(await creditAgency.creditScore(tusdPool.address, borrower.address)).to.equal(200)
      expect((await creditAgency.buckets(tusdPool.address, 255)).totalBorrowed).to.equal(0)
      expect((await creditAgency.buckets(tusdPool.address, 255)).borrowersCount).to.equal(0)
      expect((await creditAgency.buckets(tusdPool.address, 200)).totalBorrowed).to.equal(2000)
      expect((await creditAgency.buckets(tusdPool.address, 200)).borrowersCount).to.equal(1)
    })
  })

  describe('Credit score rate adjustment', () => {
    [
      [255, 0],
      [223, 143],
      [191, 335],
      [159, 603],
      [127, 1007],
      [95, 1684],
      [63, 3047],
      [31, 7225],
      [5, 50000],
      [1, 50000],
      [0, 50000],
    ].map(([score, adjustment]) =>
      it(`returns ${adjustment} when score is ${score}`, async () => {
        await creditOracle.setScore(borrower.address, score)
        await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
        expect(await creditAgency.creditScoreAdjustmentRate(tusdPool.address, borrower.address)).to.equal(adjustment)
      }),
    )
  })

  describe('Repaying', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
    })

    it('repays the funds to the pool', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await tusd.connect(borrower).approve(creditAgency.address, 1000)
      await creditAgency.connect(borrower).repay(tusdPool.address, 1000)
      expect(await tusd.balanceOf(borrower.address)).to.equal(0)
      expect(await tusd.balanceOf(tusdPool.address)).to.equal(parseEth(1e7))
    })
  })

  describe('Interest calculation', () => {
    beforeEach(async () => {
      await creditAgency.allowBorrower(borrower.address, true)
      await creditAgency.allowBorrower(owner.address, true)
      await creditAgency.setRiskPremium(1000)
      await creditOracle.setScore(owner.address, 255)
    })

    it('interest for single borrower and stable rate', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
    })

    it('interest for single borrower, rate changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditAgency.setRiskPremium(1500)
      await creditAgency.poke(tusdPool.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(250), 2)
      await creditAgency.setRiskPremium(2000)
      await creditAgency.poke(tusdPool.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(450), 2)
    })

    it('interest for single borrower, credit score changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      await creditOracle.setScore(borrower.address, 200)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(227), 2)
      await creditOracle.setScore(borrower.address, 150)
      await creditAgency.updateCreditScore(tusdPool.address, borrower.address)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(397), 2)
    })

    it('interest for multiple borrowers', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await creditAgency.connect(owner).borrow(tusdPool.address, 2000)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(100), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(0), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(200), 2)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 3000)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(200), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(200), 2)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(600), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(400), 2)
    })

    it('interest for multiple borrowers, credit score changes', async () => {
      await creditAgency.connect(borrower).borrow(tusdPool.address, 1000)
      await timeTravel(YEAR)
      await creditAgency.connect(owner).borrow(tusdPool.address, 2000)
      await timeTravel(YEAR)
      await creditAgency.connect(borrower).borrow(tusdPool.address, 3000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(600), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(400), 2)
      await creditOracle.setScore(borrower.address, 150) // 17% total rate
      await creditAgency.connect(borrower).borrow(tusdPool.address, 6000)
      await timeTravel(YEAR)
      expect(await creditAgency.interest(tusdPool.address, borrower.address)).to.be.closeTo(BigNumber.from(2300), 2)
      expect(await creditAgency.interest(tusdPool.address, owner.address)).to.be.closeTo(BigNumber.from(600), 2)
    })
  })
})
