import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { DAY, timeTravel, timeTravelTo } from 'utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'

import {
  TimeAveragedBaseRateOracle,
  TimeAveragedBaseRateOracle__factory,
  TestTimeAveragedBaseRateOracle,
  TestTimeAveragedBaseRateOracle__factory,
  MockErc20Token,
  MockErc20Token__factory,
} from 'contracts'
import { SpotBaseRateOracleJson } from 'build'

use(solidity)

describe('TimeAveragedBaseRateOracle', () => {
  let provider: MockProvider
  let owner: Wallet
  let notOwner: Wallet
  let asset: MockErc20Token

  let mockSpotOracle: MockContract
  let timeBaseRateOracle: TestTimeAveragedBaseRateOracle
  let oracleLongBuffer: TimeAveragedBaseRateOracle

  let INITIAL_TIMESTAMP
  let BUFFER_SIZE
  const MAX_BUFFER_SIZE = 365 + 1
  const COOLDOWN_TIME = DAY

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, notOwner] = wallets
    provider = _provider
    const deployContract = setupDeploy(owner)

    asset = await deployContract(MockErc20Token__factory)
    mockSpotOracle = await deployMockContract(owner, SpotBaseRateOracleJson.abi)
    await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)

    timeBaseRateOracle = await new TestTimeAveragedBaseRateOracle__factory(owner).deploy()
    await timeBaseRateOracle.initialize(mockSpotOracle.address, asset.address, COOLDOWN_TIME)

    INITIAL_TIMESTAMP = await getCurrentTimestamp()
    BUFFER_SIZE = await timeBaseRateOracle.bufferSize()

    oracleLongBuffer = await new TimeAveragedBaseRateOracle__factory(owner).deploy()
    await oracleLongBuffer.initialize(mockSpotOracle.address, asset.address, COOLDOWN_TIME)
  })

  const updateBufferRightAfterCooldown = async (oracle: TimeAveragedBaseRateOracle | TestTimeAveragedBaseRateOracle) => {
    const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
    const newestTimestamp = timestamps[currIndex].toNumber()
    await timeTravelTo(provider, newestTimestamp + COOLDOWN_TIME - 1)
    await oracle.update()
  }

  const getCurrentTimestamp = async () => {
    return (await provider.getBlock('latest')).timestamp
  }

  describe('initializer', () => {
    it('correctly sets fields', async () => {
      expect(await timeBaseRateOracle.spotOracle()).to.eq(mockSpotOracle.address)
      expect(await timeBaseRateOracle.asset()).to.eq(asset.address)
      expect(await timeBaseRateOracle.cooldownTime()).to.eq(COOLDOWN_TIME)
    })

    it('fills up one field in historical buffer', async () => {
      const [, timestamps] = await timeBaseRateOracle.getTotalsBuffer()
      expect(timestamps[0]).to.eq(INITIAL_TIMESTAMP)
    })
  })

  describe('setSpotOracle', () => {
    let newSpotOracle: MockContract

    beforeEach(async () => {
      newSpotOracle = await deployMockContract(owner, SpotBaseRateOracleJson.abi)
    })

    it('only owner can set spot oracle', async () => {
      await expect(timeBaseRateOracle.connect(notOwner).setSpotOracle(newSpotOracle.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('spot oracle is properly set', async () => {
      await timeBaseRateOracle.setSpotOracle(newSpotOracle.address)
      expect(await timeBaseRateOracle.spotOracle()).to.eq(newSpotOracle.address)
    })

    it('emits a proper event', async () => {
      await expect(timeBaseRateOracle.setSpotOracle(newSpotOracle.address))
        .to.emit(timeBaseRateOracle, 'SpotBaseRateOracleChanged')
        .withArgs(newSpotOracle.address)
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
      await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
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
      await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
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
      await timeTravel(provider, COOLDOWN_TIME - 1)
      expect(await timeBaseRateOracle.isOffCooldown()).to.be.false
    })
  })

  describe('update', () => {
    it('reverts if cooldown is on', async () => {
      await updateBufferRightAfterCooldown(timeBaseRateOracle)
      await expect(timeBaseRateOracle.update())
        .to.be.revertedWith('TimeAveragedBaseRateOracle: Buffer on cooldown')
      await timeTravel(provider, COOLDOWN_TIME)
      await expect(timeBaseRateOracle.update())
        .not.to.be.reverted
    })

    it('adds one rate to buffer', async () => {
      await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
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
        await expect(timeBaseRateOracle.calculateAverageAPY(0))
          .to.be.revertedWith('TimeAveragedBaseRateOracle: Number of values should be greater than 0')
      })

      it('numberOfValues is not less than buffer size', async () => {
        let numberOfValues = BUFFER_SIZE + 1
        await expect(timeBaseRateOracle.calculateAverageAPY(numberOfValues))
          .to.be.revertedWith('TimeAveragedBaseRateOracle: Number of values should be less than buffer size')
        numberOfValues = BUFFER_SIZE
        await expect(timeBaseRateOracle.calculateAverageAPY(numberOfValues))
          .to.be.revertedWith('TimeAveragedBaseRateOracle: Number of values should be less than buffer size')
      })

      it('before any update call', async () => {
        await expect(timeBaseRateOracle.calculateAverageAPY(2))
          .to.be.revertedWith('TimeAveragedBaseRateOracle: Cannot use buffer before any update call')
      })
    })

    describe('calculates the rate correctly', () => {
      it('with partially filled buffer', async () => {
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 1.0, 2.0 probed with 1 day interval
        // Expected value is 3/2 = 1.5
        expect(await timeBaseRateOracle.calculateAverageAPY(2)).to.eq(1_50)

        // If buffer has not requested number of values yet
        // use all values available at the moment
        expect(await timeBaseRateOracle.calculateAverageAPY(7)).to.eq(1_50)
      })

      it('with overwritten buffer', async () => {
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
        }
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 15 / 7 = 2.(142857)
        expect(await timeBaseRateOracle.calculateAverageAPY(7)).to.eq(2_14)
      })

      it('spot apy value has no impact on average apy', async () => {
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)
        await updateBufferRightAfterCooldown(timeBaseRateOracle)
        // Borrow apys (percents): 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 2.0 + 3.0) / 3 = 2.0
        expect(await timeBaseRateOracle.calculateAverageAPY(3)).to.eq(2_00)
      })
    })

    describe('getWeeklyAPY', () => {
      describe('returns correct value if', () => {
        it('apy grows', async () => {
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(400)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          // Borrow apys (percents): 1.0, 1.0, 1.0, 1.0, 2.0, 3.0, 4.0 probed with 1 day interval
          // Expected avg apy is (1.0 * 3 + 2.0 * 2 + 3.0 + 4.0) / 7 = 2.0
          // Expected weekly apy is 2.0
          expect(await timeBaseRateOracle.calculateAverageAPY(7)).to.eq(2_00)
          expect(await timeBaseRateOracle.getWeeklyAPY()).to.eq(2_00)
        })

        it('apy goes up and down', async () => {
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(300)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(200)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns(100)
          await updateBufferRightAfterCooldown(timeBaseRateOracle)
          // Borrow apys (percents): 2.0, 1.0, 3, 2.0, 3.0, 2.0, 1.0 probed with 1 day interval
          // Expected avg apy is 14 / 7 = 2.0
          // Expected weekly apy is 2.0
          expect(await timeBaseRateOracle.calculateAverageAPY(7)).to.eq(2_00)
          expect(await timeBaseRateOracle.getWeeklyAPY()).to.eq(2_00)
        })
      })
    })

    describe('getMonthlyAPY', () => {
      it('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 30; i++) {
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns((10 + i) * 100)
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Borrow apys (percents): 10, 11, ..., 39 probed with 1 day interval
        // Expected avg apy is 24.5
        // Expected monthly apy is 24.5
        expect(await oracleLongBuffer.getMonthlyAPY()).to.eq(24_50)
      })
    })

    describe('getYearlyAPY', () => {
      xit('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockSpotOracle.mock.getRate.withArgs(asset.address).returns((10 + i) * 100)
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Borrow apys (percents): 10, 11, ..., 374 probed with 1 day interval
        // Expected avg apy is 192
        // Expected yearly apy is 192
        expect(await oracleLongBuffer.getYearlyAPY()).to.eq(192_00)
      }).timeout(100_000)
    })
  })
})
