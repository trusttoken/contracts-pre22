import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { DAY, timeTravelTo } from 'utils'

import {
  CrvBaseRateOracle,
  CrvBaseRateOracle__factory,
} from 'contracts'
import { ICurveJson } from 'build'

use(solidity)

describe('CrvBaseRateOracle', () => {
  let provider: MockProvider
  let owner: Wallet
  let crvBaseRateOracle: CrvBaseRateOracle
  let mockCurve: MockContract

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    mockCurve = await deployMockContract(owner, ICurveJson.abi)

    crvBaseRateOracle = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address)
    provider = _provider
  })

  describe('Constructor', () => {
    it('correctly sets curve interface', async () => {
      expect(await crvBaseRateOracle.curve()).to.eq(mockCurve.address)
    })
  })

  describe('updateRate', () => {
    it('calls get_virtual_price and stores rate and block timestamp', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      await crvBaseRateOracle.updateRate()
      const curTimestamp = (await provider.getBlock('latest')).timestamp
      expect(await crvBaseRateOracle.getStoredData())
        .to.deep.equal([BigNumber.from(100), BigNumber.from(curTimestamp)])
    })
  })

  describe('rate', () => {
    it('reverts if updateRate hasn\'t been called yet', async () => {
      await expect(crvBaseRateOracle.rate(0))
        .to.be.revertedWith('CrvBaseRateOracle: rateUpdate must be called at least once')
    })

    it('reverts if current value is less than stored one', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      await crvBaseRateOracle.updateRate()
      await mockCurve.mock.get_virtual_price.returns(99)
      await expect(crvBaseRateOracle.rate(0))
        .to.be.revertedWith('CrvBaseRateOracle: rate function should be monotonically increasing')
    })

    const initialPrice = 100
    const newPrice = 500
    const forHowDaysInFuture = [2, 7, 30, 60, 100, 365, 2 * 365]
    const updateTimeDays = [1 / 2, 1, 2]
    for (const t of forHowDaysInFuture) {
      for (const updateTime of updateTimeDays) {
        it(`predicts value for ${t} days ahead with time diff of ${updateTime} days`, async () => {
          const travelTime = updateTime * DAY
          await mockCurve.mock.get_virtual_price.returns(initialPrice)
          await crvBaseRateOracle.updateRate()
          const curTimestamp = (await provider.getBlock('latest')).timestamp
          await mockCurve.mock.get_virtual_price.returns(newPrice)
          await timeTravelTo(provider, curTimestamp + travelTime)
          const expectedValue = (newPrice - initialPrice) / travelTime * t * DAY / newPrice * 10000
          expect(await crvBaseRateOracle.rate(t * DAY)).to.eq(Math.round(expectedValue))
        })
      }
    }
  })
})
