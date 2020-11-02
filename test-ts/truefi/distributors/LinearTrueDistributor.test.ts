import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'

import { expectCloseTo } from '../../utils/expectCloseTo'
import { beforeEachWithFixture } from '../../utils/beforeEachWithFixture'
import { toTrustToken } from '../../../scripts/utils'
import { LinearTrueDistributor } from '../../../build/types/LinearTrueDistributor'
import { LinearTrueDistributorFactory } from '../../../build/types/LinearTrueDistributorFactory'
import { MockErc20TokenFactory } from '../../../build/types/MockErc20TokenFactory'
import { MockErc20Token } from '../../../build/types/MockErc20Token'
import { timeTravel, timeTravelTo } from '../../utils/timeTravel'

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

    it('emits event', async () => {
      await expect(distributor.setFarm(farm.address)).to.emit(distributor, 'FarmChanged').withArgs(farm.address)
    })
  })

  describe('distribute', () => {
    beforeEach(async () => {
      await distributor.setFarm(farm.address)
    })

    it('does not distribute anything if called before distribution start', async () => {
      await timeTravel(provider, DAY / 2)
      await distributor.distribute(farm.address)
      expect(await trustToken.balanceOf(farm.address)).to.equal(0)
    })

    it('distributes everything if called after distribution is over', async () => {
      await timeTravel(provider, DAY * 35)
      await distributor.distribute(farm.address)
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
          await distributor.distribute(farm.address)
          const balanceAfter = await trustToken.balanceOf(farm.address)
          expect(expectCloseTo(balanceAfter.sub(balanceBefore), distributionAmount.div(30)))
        }
      })

      it('distributions sum up to total amount', async () => {
        for (let i = 0; i < 30; i++) {
          await timeTravel(provider, DAY)
          await distributor.distribute(farm.address)
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
  })
})
