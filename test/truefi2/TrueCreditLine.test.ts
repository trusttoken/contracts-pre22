import {
  TrueFiPool2,
  TestTrueCreditLine,
  TestTrueCreditLine__factory,
  MockTrueCurrency,
} from 'contracts'
import { expect, use } from 'chai'
import { deployContract, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth, setupTruefi2 } from 'utils'

use(solidity)

describe('TrueCreditLine', () => {
  let owner: Wallet
  let creditAgency: Wallet
  let borrower: Wallet
  let holder: Wallet
  let pool: TrueFiPool2
  let token: MockTrueCurrency
  let creditLine: TestTrueCreditLine

  const PRECISION = BigNumber.from(10).pow(30)

  const fullReward = parseEth(1)
  const splitReward = fullReward.div(2)
  let principalDebt = parseEth(1000)

  async function updateDebt () {
    principalDebt = await creditLine.principalDebt()
  }

  beforeEachWithFixture(async (wallets) => {
    [owner, borrower, holder, creditAgency] = wallets

    ;({ standardPool: pool, standardToken: token } = await setupTruefi2(owner))
    creditLine = await deployContract(owner, TestTrueCreditLine__factory, [creditAgency.address, borrower.address, pool.address, principalDebt])

    await token.mint(borrower.address, parseEth(1000))
    await token.connect(borrower).approve(creditLine.address, parseEth(1000))
  })

  describe('on creation', () => {
    it('sets creditAgency', async () => {
      expect(await creditLine.creditAgency()).to.eq(creditAgency.address)
    })

    it('sets borrower', async () => {
      expect(await creditLine.borrower()).to.eq(borrower.address)
    })

    it('sets pool', async () => {
      expect(await creditLine.pool()).to.eq(pool.address)
    })

    it('sets principal debt', async () => {
      expect(await creditLine.principalDebt()).to.eq(principalDebt)
    })

    it('mints tokens to the pool', async () => {
      expect(await creditLine.balanceOf(pool.address)).to.eq(principalDebt)
    })

    it('returns correct version', async () => {
      expect(await creditLine.version()).to.eq(0)
    })
  })

  describe('updating rewards', () => {
    describe('cumulativeTotalRewardPerToken', () => {
      it('initially 0', async () => {
        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(0)
      })

      it('updated after payInterest', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)
        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })

      it('updated after payInterest 2 holders', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })

      it('not changed by transfer', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))

        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })

      it('not changed by transferFrom', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))

        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })
    })

    describe('previousCumulatedRewardPerToken', () => {
      it('initially 0', async () => {
        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(0)
      })

      it('updated after payInterest', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)
        await updateDebt()
        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })

      it('updated after payInterest 2 holders', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)
      })

      it('updated after transfer', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)
        expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(0)

        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })

      it('updated after transferFrom', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)
        expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(0)

        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
        expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      })
    })

    describe('claimableRewards', () => {
      it('initially 0', async () => {
        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      })

      it('updated after payInterest', async () => {
        // 0 because pool always instantly claims
        await creditLine.connect(borrower).payInterest(fullReward)
        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      })

      it('updated after payInterest 2 holders', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      })

      it('updated after transfer', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)

        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)
      })

      it('updated after transferFrom', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)

        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
        expect(await creditLine.claimableRewards(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimableRewards(owner.address)).to.eq(0)
      })
    })

    describe('totalInterestRewards', () => {
      it('initially 0', async () => {
        expect(await creditLine.totalInterestRewards()).to.eq(0)
      })

      it('updated after payInterest', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)
        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      })

      it('updated after payInterest 2 holders', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      })

      it('not changed by transfer', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))

        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      })

      it('not changed by transferFrom', async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await updateDebt()
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))

        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      })
    })
  })

  describe('claimable', () => {
    describe('only pool holds CreditLine tokens', () => {
      it('initially 0 rewards', async () => {
        expect(await creditLine.claimable(pool.address)).to.eq(0)
      })

      it('updates rewards after payInterest', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)

        expect(await creditLine.claimable(pool.address)).to.eq(0)
      })
    })

    describe('two holders of CreditLine', () => {
      beforeEach(async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await creditLine.connect(borrower).payInterest(fullReward)
      })

      it('updates rewards after payInterest', async () => {
        expect(await creditLine.claimable(pool.address)).to.eq(0)
        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
      })

      it('updates holders rewards after transfer', async () => {
        await creditLine.connect(holder).transfer(owner.address, parseEth(1000))

        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimable(owner.address)).to.eq(0)

        await creditLine.connect(borrower).payInterest(fullReward)
        await creditLine.connect(owner).transfer(holder.address, parseEth(1000))

        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimable(owner.address)).to.eq(splitReward)
      })

      it('updates holders rewards after transferFrom', async () => {
        await creditLine.connect(holder).approve(owner.address, parseEth(1000))
        await creditLine.connect(owner).approve(holder.address, parseEth(1000))

        await creditLine.connect(owner).transferFrom(holder.address, owner.address, parseEth(1000))

        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimable(owner.address)).to.eq(0)

        await creditLine.connect(borrower).payInterest(fullReward)
        await creditLine.connect(holder).transferFrom(owner.address, holder.address, parseEth(1000))

        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
        expect(await creditLine.claimable(owner.address)).to.eq(splitReward)
      })
    })
  })

  describe('claim', () => {
    describe('payInterest triggers claim for pool', () => {
      it('pool gets interest tokens', async () => {
        await expect(() => creditLine.connect(borrower).payInterest(fullReward))
          .to.changeTokenBalance(token, pool, fullReward)
      })

      it('sets claimable for pool to 0', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)
        expect(await creditLine.claimable(pool.address)).to.eq(0)
      })

      it('increases totalClaimedRewards', async () => {
        await creditLine.connect(borrower).payInterest(fullReward)
        expect(await creditLine.totalClaimedRewards()).to.eq(fullReward)
      })

      it('emits claim event', async () => {
        expect(await creditLine.connect(borrower).payInterest(fullReward))
          .to.emit(creditLine, 'Claimed')
          .withArgs(pool.address, fullReward)
      })
    })

    describe('called by non pool holder', () => {
      beforeEach(async () => {
        await creditLine.mint(holder.address, parseEth(1000))
        await creditLine.connect(borrower).payInterest(fullReward)
      })

      it('transfers tokens', async () => {
        await expect(() => creditLine.connect(holder).claim())
          .to.changeTokenBalance(token, holder, splitReward)
      })

      it('changes claimable state', async () => {
        expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
        await creditLine.connect(holder).claim()
        expect(await creditLine.claimable(holder.address)).to.eq(0)
      })

      it('increases totalClaimedRewards', async () => {
        expect(await creditLine.totalClaimedRewards()).to.eq(splitReward)
        await creditLine.connect(holder).claim()
        expect(await creditLine.totalClaimedRewards()).to.eq(fullReward)
      })

      it('emits event', async () => {
        await expect(creditLine.connect(holder).claim())
          .to.emit(creditLine, 'Claimed')
          .withArgs(holder.address, splitReward)
      })
    })
  })

  describe('increasePrincipalDebt', () => {
    it('can only be called by creditAgency', async () => {
      await expect(creditLine.connect(borrower).increasePrincipalDebt(parseEth(1000)))
        .to.be.revertedWith('TrueCreditLine: Caller is not the credit agency')
    })

    it('increases principalDebt', async () => {
      await creditLine.connect(creditAgency).increasePrincipalDebt(parseEth(1000))
      expect(await creditLine.principalDebt()).to.eq(parseEth(2000))
    })

    it('mints more tokens to the pool', async () => {
      await creditLine.connect(creditAgency).increasePrincipalDebt(parseEth(1000))
      expect(await creditLine.balanceOf(pool.address)).to.eq(parseEth(2000))
    })

    it('emits event', async () => {
      await expect(creditLine.connect(creditAgency).increasePrincipalDebt(parseEth(1000)))
        .to.emit(creditLine, 'DebtIncreased')
        .withArgs(borrower.address, parseEth(1000))
    })
  })

  describe('Complex scenarios', () => {
    const quarterReward = splitReward.div(2)

    it('complex claim scenario for multiple repayments', async () => {
      // holder will claim rewards, owner will not claim rewards, pool claims rewards automatically
      await creditLine.mint(holder.address, parseEth(500))
      await creditLine.mint(owner.address, parseEth(500))
      await updateDebt()

      // first interest repay
      await creditLine.connect(borrower).payInterest(fullReward)

      expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(PRECISION).div(principalDebt))
      expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      expect(await creditLine.totalClaimedRewards()).to.eq(splitReward)

      // pool
      expect(await creditLine.claimable(pool.address)).to.eq(0)
      expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))

      // holder
      expect(await creditLine.claimable(holder.address)).to.eq(quarterReward)
      expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)

      await creditLine.connect(holder).claim()
      expect(await creditLine.claimable(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))

      // owner
      expect(await creditLine.claimable(owner.address)).to.eq(quarterReward)
      expect(await creditLine.claimableRewards(owner.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(0)

      // second interest repay
      await creditLine.connect(borrower).payInterest(fullReward)

      expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(fullReward.mul(2).mul(PRECISION).div(principalDebt))
      expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(2).mul(PRECISION))
      expect(await creditLine.totalClaimedRewards()).to.eq(splitReward.mul(2).add(quarterReward))

      // pool
      expect(await creditLine.claimable(pool.address)).to.eq(0)
      expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(fullReward.mul(2).mul(PRECISION).div(principalDebt))

      // holder
      expect(await creditLine.claimable(holder.address)).to.eq(quarterReward)
      expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(fullReward.mul(PRECISION).div(principalDebt))

      await creditLine.connect(holder).claim()
      expect(await creditLine.claimable(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(fullReward.mul(2).mul(PRECISION).div(principalDebt))

      // owner
      expect(await creditLine.claimable(owner.address)).to.eq(quarterReward.mul(2))
      expect(await creditLine.claimableRewards(owner.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(owner.address)).to.eq(0)
    })

    it('complex transfer scenario', async () => {
      // owner and holder transfer credit line tokens between each other
      await creditLine.mint(holder.address, parseEth(600))
      await creditLine.mint(owner.address, parseEth(400))
      await updateDebt()

      // first interest repay
      await creditLine.connect(borrower).payInterest(fullReward)

      expect(await creditLine.claimable(holder.address)).to.eq(splitReward.mul(6).div(10))
      expect(await creditLine.claimable(owner.address)).to.eq(splitReward.mul(4).div(10))

      await creditLine.connect(owner).transfer(holder.address, parseEth(200))

      expect(await creditLine.claimable(holder.address)).to.eq(splitReward.mul(6).div(10))
      expect(await creditLine.claimable(owner.address)).to.eq(splitReward.mul(4).div(10))

      await creditLine.connect(borrower).payInterest(fullReward)

      expect(await creditLine.claimable(holder.address)).to.eq(splitReward.mul(6).div(10).add(splitReward.mul(8).div(10)))
      expect(await creditLine.claimable(owner.address)).to.eq(splitReward.mul(4).div(10).add(splitReward.mul(2).div(10)))
    })

    it('borrower increases debt', async () => {
      await creditLine.mint(holder.address, parseEth(1000))
      await updateDebt()

      // first interest repay
      await creditLine.connect(borrower).payInterest(fullReward)

      const prevCumTotalRewardPerToken = fullReward.mul(PRECISION).div(principalDebt)

      expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(prevCumTotalRewardPerToken)
      expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(PRECISION))
      expect(await creditLine.totalClaimedRewards()).to.eq(splitReward)

      // pool
      expect(await creditLine.claimable(pool.address)).to.eq(0)
      expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(prevCumTotalRewardPerToken)

      // holder
      expect(await creditLine.claimable(holder.address)).to.eq(splitReward)
      expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)

      // borrower increases debt
      await creditLine.connect(creditAgency).increasePrincipalDebt(parseEth(2000))
      await updateDebt()

      // second interest repay
      await creditLine.connect(borrower).payInterest(fullReward.mul(2))

      expect(await creditLine.cumulativeTotalRewardPerToken()).to.eq(prevCumTotalRewardPerToken.add(fullReward.mul(2).mul(PRECISION).div(principalDebt)))
      expect(await creditLine.totalInterestRewards()).to.eq(fullReward.mul(3).mul(PRECISION))
      expect(await creditLine.totalClaimedRewards()).to.eq(splitReward.add(fullReward.mul(2).mul(3).div(4)))

      // pool
      expect(await creditLine.claimable(pool.address)).to.eq(0)
      expect(await creditLine.claimableRewards(pool.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(pool.address)).to.eq(prevCumTotalRewardPerToken.add(fullReward.mul(2).mul(PRECISION).div(principalDebt)))

      // holder
      expect(await creditLine.claimable(holder.address)).to.eq(splitReward.add(fullReward.mul(2).mul(1).div(4)))
      expect(await creditLine.claimableRewards(holder.address)).to.eq(0)
      expect(await creditLine.previousCumulatedRewardPerToken(holder.address)).to.eq(0)
    })
  })
})
