import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { toTrustToken } from 'scripts/utils'

import {
  expectScaledCloseTo,
  beforeEachWithFixture,
  timeTravel,
  timeTravelTo,
} from 'utils'

import {
  LinearTrueDistributor,
  LinearTrueDistributorFactory,
  MockErc20TokenFactory,
  MockErc20Token,
} from 'contracts'

describe('LinearTrueDistributor', () => {
  const DAY = 24 * 3600

  let owner: Wallet
  let farm: Wallet
  let distributor: LinearTrueDistributor
  let trustToken: MockErc20Token
  let provider: MockProvider
  const distributionAmount = toTrustToken(100)
  let startDate

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, farm] = wallets
    provider = _provider
    trustToken = await new MockErc20TokenFactory(owner).deploy()
    const now = Math.floor(Date.now() / 1000)
    startDate = now + DAY
    distributor = await new LinearTrueDistributorFactory(owner).deploy()
    await distributor.initialize(startDate, DAY * 30, distributionAmount, trustToken.address)
    await trustToken.mint(distributor.address, distributionAmount)
  })

  describe('Setting farm address', () => {
    it('sets farm to new address', async () => {
      await distributor.setFarm(farm.address)
      expect(await distributor.farm()).to.equal(farm.address)
    })

    it('reverts if done not by owner', async () => {
      await expect(distributor.connect(farm).setFarm(farm.address)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('emits event when farm is set', async () => {
      await expect(distributor.setFarm(farm.address)).to.emit(distributor, 'FarmChanged').withArgs(farm.address)
    })
  })

  describe('setDailyDistribution', () => {
    it('only owner can call it', async () => {
      await expect(distributor.connect(farm).setDailyDistribution('1'))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets new total amount properly for whole duration', async () => {
      await distributor.setDailyDistribution('1')
      expect(await distributor.totalAmount()).to.equal('30')
    })

    it('sets new total amount properly for half of the duration', async () => {
      await distributor.setFarm(farm.address)
      await timeTravel(provider, DAY * 16)

      const balanceBefore = await trustToken.balanceOf(farm.address)
      await distributor.setDailyDistribution(toTrustToken('1'))
      const balanceAfter = await trustToken.balanceOf(farm.address)

      expectScaledCloseTo(balanceAfter.sub(balanceBefore), distributionAmount.div(2))
      expectScaledCloseTo(
        await distributor.totalAmount(),
        toTrustToken('1').mul(15),
      )
    })

    it('after changing total amount distribution is conducted properly', async () => {
      await distributor.setFarm(farm.address)
      await timeTravel(provider, DAY * 16)

      await distributor.setDailyDistribution(toTrustToken('1'))

      await timeTravel(provider, DAY)

      let balanceBefore = await trustToken.balanceOf(farm.address)
      await distributor.distribute()
      let balanceAfter = await trustToken.balanceOf(farm.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), toTrustToken('1'))

      await timeTravel(provider, DAY * 2)

      balanceBefore = await trustToken.balanceOf(farm.address)
      await distributor.distribute()
      balanceAfter = await trustToken.balanceOf(farm.address)
      expectScaledCloseTo(balanceAfter.sub(balanceBefore), toTrustToken('1').mul(2))
    })
  })

  describe('distribute', () => {
    beforeEach(async () => {
      await distributor.setFarm(farm.address)
    })

    it('does not distribute anything if called before distribution start', async () => {
      await timeTravel(provider, DAY / 2)
      await distributor.distribute()
      expect(await trustToken.balanceOf(farm.address)).to.equal(0)
    })

    it('distributes everything if called after distribution is over', async () => {
      await timeTravel(provider, DAY * 35)
      expect(await distributor.nextDistribution()).to.equal(distributionAmount)
      await distributor.distribute()
      expect(await trustToken.balanceOf(farm.address)).to.equal(distributionAmount)
    })

    describe('multiple distribute calls', () => {
      beforeEach(async () => {
        await timeTravelTo(provider, startDate)
      })

      it('all distributions are close to being linear', async () => {
        for (let i = 0; i < 30; i++) {
          await timeTravel(provider, DAY)
          const balanceBefore = await trustToken.balanceOf(farm.address)
          await distributor.distribute()
          const balanceAfter = await trustToken.balanceOf(farm.address)
          expectScaledCloseTo(balanceAfter.sub(balanceBefore), distributionAmount.div(30))
        }
      })

      it('distributions sum up to total amount', async () => {
        for (let i = 0; i < 30; i++) {
          await timeTravel(provider, DAY)
          await distributor.distribute()
        }
        expect(await trustToken.balanceOf(farm.address)).to.equal(distributionAmount)
      })
    })
  })

  describe('empty', () => {
    it('only owner can empty', async () => {
      await expect(distributor.connect(farm).empty())
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('transfer total balance to sender', async () => {
      const totalBalance = await trustToken.balanceOf(distributor.address)
      await expect(() => distributor.empty())
        .to.changeTokenBalance(trustToken, owner, totalBalance)
    })

    it('ends distribution', async () => {
      await timeTravelTo(provider, startDate + DAY)
      await distributor.distribute()
      await timeTravel(provider, DAY)
      await distributor.empty()
      await timeTravel(provider, DAY)
      expect(await distributor.nextDistribution()).to.equal(0)
      await expect(distributor.distribute()).to.be.not.reverted
    })
  })
})
