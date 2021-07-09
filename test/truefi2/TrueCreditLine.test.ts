import {
  TrueFiPool2,
  TestTrueCreditLine,
  TestTrueCreditLine__factory,
  MockTrueCurrency,
} from 'contracts'
import { expect, use } from 'chai'
import { deployContract, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth, setupTruefi2 } from 'utils'

use(solidity)

describe('TrueCreditLine', () => {
  let owner: Wallet
  let borrower: Wallet
  let holder: Wallet
  let pool: TrueFiPool2
  let token: MockTrueCurrency
  let creditLine: TestTrueCreditLine

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower, holder] = wallets

    ;({ standardPool: pool, standardToken: token } = await setupTruefi2(owner))
    creditLine = await deployContract(owner, TestTrueCreditLine__factory, [owner.address, pool.address, parseEth(1000)])

    await token.mint(borrower.address, parseEth(1000))
    await token.connect(borrower).approve(creditLine.address, parseEth(1000))
  })

  describe('on creation', () => {
    it('sets borrower', async () => {
      expect(await creditLine.borrower()).to.eq(owner.address)
    })

    it('sets pool', async () => {
      expect(await creditLine.pool()).to.eq(pool.address)
    })

    it('sets principal debt', async () => {
      expect(await creditLine.principalDebt()).to.eq(parseEth(1000))
    })

    it('mints tokens to the pool', async () => {
      expect(await creditLine.balanceOf(pool.address)).to.eq(parseEth(1000))
    })

    it('returns correct version', async () => {
      expect(await creditLine.version()).to.eq(0)
    })
  })

  describe('updating rewards', () => {
    const fullReward = parseEth(1)
    const splitReward = fullReward.div(2)

    describe('only pool holds CreditLine tokens', () => {
      it('initially 0 rewards', async () => {
        expect(await creditLine.cumulativeTotalRewards()).to.eq(0)
        expect(await creditLine.previousCumulatedRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.totalInterestRewards()).to.eq(0)
        expect(await creditLine.totalClaimedRewards()).to.eq(0)
      })

      it('updates rewards after payInterest', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.cumulativeTotalRewards()).to.eq(0)
        expect(await creditLine.previousCumulatedRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.totalInterestRewards()).to.eq(0)
        expect(await creditLine.totalClaimedRewards()).to.eq(0)

        // second call just to update
        await creditLine.connect(borrower).payInterest(parseEth(0))

        expect(await creditLine.cumulativeTotalRewards()).to.eq(fullReward)
        expect(await creditLine.previousCumulatedRewards(pool.address)).to.eq(fullReward)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(fullReward)
        expect(await creditLine.totalInterestRewards()).to.eq(fullReward)
        expect(await creditLine.totalClaimedRewards()).to.eq(0)
      })
    })

    describe('two holders of CreditLine', () => {
      beforeEach(async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await creditLine.connect(borrower).payInterest(fullReward)
      })

      it('updates rewards after payInterest', async () => {
        expect(await creditLine.cumulativeTotalRewards()).to.eq(0)
        expect(await creditLine.previousCumulatedRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.totalInterestRewards()).to.eq(0)
        expect(await creditLine.totalClaimedRewards()).to.eq(0)

        expect(await creditLine.claimableRewards(holder.address)).to.eq(0)

        // second call just to update
        await creditLine.connect(borrower).payInterest(parseEth(0))

        expect(await creditLine.cumulativeTotalRewards()).to.eq(fullReward)
        expect(await creditLine.previousCumulatedRewards(pool.address)).to.eq(fullReward)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(splitReward)
        expect(await creditLine.totalInterestRewards()).to.eq(fullReward)
        expect(await creditLine.totalClaimedRewards()).to.eq(0)

        expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      })

      it('updates holders rewards after transfer', async () => {
        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)

        await creditLine.connect(borrower).payInterest(fullReward)
        await creditLine.connect(owner).transfer(holder.address, parseEth(1000))

        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(splitReward)
      })

      it('updates holders rewards after transferFrom', async () => {
        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).approve(holder.address, parseEth(1000))

        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)

        await creditLine.connect(borrower).payInterest(fullReward)
        await creditLine.connect(holder).transferFrom(owner.address, holder.address, parseEth(1000))

        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(splitReward)
      })
    })
  })
})
