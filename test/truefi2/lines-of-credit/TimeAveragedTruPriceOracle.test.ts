import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { DAY, timeTravel, timeTravelTo, updateRateOracle } from 'utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'

import {
  TimeAveragedTruPriceOracle,
  TimeAveragedTruPriceOracle__factory,
  TestTimeAveragedTruPriceOracle,
  TestTimeAveragedTruPriceOracle__factory,
} from 'contracts'
import { AggregatorV3InterfaceJson } from 'build'

use(solidity)

describe('TimeAveragedTruPriceOracle', () => {
  let provider: MockProvider
  let owner: Wallet

  let mockAggregator: MockContract
  let timeBaseRateOracle: TestTimeAveragedTruPriceOracle
  let oracleLongBuffer: TimeAveragedTruPriceOracle

  let INITIAL_TIMESTAMP
  let BUFFER_SIZE
  const MAX_BUFFER_SIZE = 365 + 1
  const COOLDOWN_TIME = DAY

  async function setPrice (price: number) {
    await mockAggregator.mock.latestRoundData.returns(0, price, 0, 0, 0)
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    provider = _provider

    mockAggregator = await deployMockContract(owner, AggregatorV3InterfaceJson.abi)
    await setPrice(100)

    timeBaseRateOracle = await new TestTimeAveragedTruPriceOracle__factory(owner).deploy()
    await timeBaseRateOracle.initialize(mockAggregator.address, COOLDOWN_TIME)

    INITIAL_TIMESTAMP = await getCurrentTimestamp()
    BUFFER_SIZE = await timeBaseRateOracle.bufferSize()

    oracleLongBuffer = await new TimeAveragedTruPriceOracle__factory(owner).deploy()
    await oracleLongBuffer.initialize(mockAggregator.address, COOLDOWN_TIME)
  })

  const updateBufferRightAfterCooldown = async (oracle: TimeAveragedTruPriceOracle | TestTimeAveragedTruPriceOracle) => {
    await updateRateOracle(oracle, COOLDOWN_TIME, provider)
  }

  const getCurrentTimestamp = async () => {
    return (await provider.getBlock('latest')).timestamp
  }

  describe('initializer', () => {
    it('correctly sets fields', async () => {
      expect(await timeBaseRateOracle.truPriceFeed()).to.eq(mockAggregator.address)
      expect(await timeBaseRateOracle.cooldownTime()).to.eq(COOLDOWN_TIME)
    })

    it('fills up one field in historical buffer', async () => {
      const [, timestamps] = await timeBaseRateOracle.getTotalsBuffer()
      expect(timestamps[0]).to.eq(INITIAL_TIMESTAMP)
    })
  })

  describe('RunningTotalsBuffer', () => {
    it('has expected capacity', async () => {
      const [runningTotals, timestamps] = await timeBaseRateOracle.getTotalsBuffer()
      expect(runningTotals.length).to.eq(MAX_BUFFER_SIZE)
      expect(timestamps.length).to.eq(MAX_BUFFER_SIZE)
    })

    it('has expected initial current index of 0', async () => {
      const [, , currIndex] = await timeBaseRateOracle.getTotalsBuffer()
      expect(currIndex).to.eq(0)
    })

    it('insertIndex increments cyclically', async () => {
      await setPrice(100)
      for (let i = 0; i < BUFFER_SIZE - 1; i++) {
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        const [, , currIndex] = await timeBaseRateOracle.getTotalsBuffer()
        expect(currIndex).to.eq(i + 1)
      }
      await updateBufferRightAfterCooldown(timeBaseRateOracle)
      const [, , currIndex] = await timeBaseRateOracle.getTotalsBuffer()
      expect(currIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await setPrice(100)
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
      }
      let [runningTotals] = await timeBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(8640000)
      await updateBufferRightAfterCooldown(timeBaseRateOracle)
      ;[runningTotals] = await timeBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(77760000)
    })
  })

  describe('isOffCooldown', () => {
    beforeEach(async () => {
      await timeTravelTo(provider, INITIAL_TIMESTAMP + COOLDOWN_TIME)
    })

    it('returns true if cooldown is off', async () => {
      expect(await timeBaseRateOracle.isOffCooldown()).to.be.true
      await timeBaseRateOracle.update()
      await timeTravel(provider, COOLDOWN_TIME)
      expect(await timeBaseRateOracle.isOffCooldown()).to.be.true
    })

    it('returns false if cooldown is on', async () => {
      await timeBaseRateOracle.update()
      expect(await timeBaseRateOracle.isOffCooldown()).to.be.false
      await timeTravel(provider, COOLDOWN_TIME - 10)
      expect(await timeBaseRateOracle.isOffCooldown()).to.be.false
    })
  })

  describe('update', () => {
    it('reverts if cooldown is on', async () => {
      await updateBufferRightAfterCooldown(timeBaseRateOracle)
      await expect(timeBaseRateOracle.update())
        .to.be.revertedWith('TimeAveragedTruPriceOracle: Buffer on cooldown')
      await timeTravel(provider, COOLDOWN_TIME)
      await expect(timeBaseRateOracle.update())
        .not.to.be.reverted
    })

    it('adds one rate to buffer', async () => {
      await setPrice(100)
      await updateBufferRightAfterCooldown(timeBaseRateOracle)
      const curTimestamp = await getCurrentTimestamp()
      const [runningTotals, timestamps, currIndex] = await timeBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(8640000)
      expect(timestamps[1]).to.eq(curTimestamp)
      expect(currIndex).to.eq(1)
    })
  })

  describe('calculateAverageRate', () => {
    describe('reverts if', () => {
      it('numberOfValues equals 0', async () => {
        await expect(timeBaseRateOracle.calculateAveragePrice(0))
          .to.be.revertedWith('TimeAveragedTruPriceOracle: Number of values should be greater than 0')
      })

      it('numberOfValues is not less than buffer size', async () => {
        let numberOfValues = BUFFER_SIZE + 1
        await expect(timeBaseRateOracle.calculateAveragePrice(numberOfValues))
          .to.be.revertedWith('TimeAveragedTruPriceOracle: Number of values should be less than buffer size')
        numberOfValues = BUFFER_SIZE
        await expect(timeBaseRateOracle.calculateAveragePrice(numberOfValues))
          .to.be.revertedWith('TimeAveragedTruPriceOracle: Number of values should be less than buffer size')
      })

      it('before any update call', async () => {
        await expect(timeBaseRateOracle.calculateAveragePrice(2))
          .to.be.revertedWith('TimeAveragedTruPriceOracle: Cannot use buffer before any update call')
      })
    })

    describe('calculates the rate correctly', () => {
      it('with partially filled buffer', async () => {
        await setPrice(100)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await setPrice(200)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 1.0, 2.0 probed with 1 day interval
        // Expected value is 3/2 = 1.5
        expect(await timeBaseRateOracle.calculateAveragePrice(2)).to.eq(150)

        // If buffer has not requested number of values yet
        // use all values available at the moment
        expect(await timeBaseRateOracle.calculateAveragePrice(7)).to.eq(150)
      })

      it('with overwritten buffer', async () => {
        await setPrice(200)
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
        }
        await setPrice(300)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 15 / 7 = 2.(142857)
        expect(await timeBaseRateOracle.calculateAveragePrice(7)).to.eq(214)
      })

      it('spot apy value has no impact on average apy', async () => {
        await setPrice(100)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await setPrice(200)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await setPrice(300)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 2.0 + 3.0) / 3 = 2.0
        expect(await timeBaseRateOracle.calculateAveragePrice(3)).to.eq(200)
      })
    })

    describe('getWeeklyPrice', () => {
      describe('returns correct value if', () => {
        it('apy grows', async () => {
          await setPrice(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(400)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          // Price: 100, 100, 100, 100, 200, 300, 400 probed with 1 day interval
          // Expected avg price is 100*(1 * 3 + 2 * 2 + 3 + 4) / 7 = 200
          // Expected weekly price is 200
          expect(await timeBaseRateOracle.calculateAveragePrice(7)).to.eq(200)
          expect(await timeBaseRateOracle.getWeeklyPrice()).to.eq(200)
        })

        it('apy goes up and down', async () => {
          await setPrice(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await setPrice(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          expect(await timeBaseRateOracle.calculateAveragePrice(7)).to.eq(200)
          expect(await timeBaseRateOracle.getWeeklyPrice()).to.eq(200)
        })
      })
    })
  })
})
