import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { DAY, expectCloseTo, timeTravel, timeTravelTo } from 'utils'

import {
  CrvBaseRateOracle,
  CrvBaseRateOracle__factory,
  MockCrvBaseRateOracle,
  MockCrvBaseRateOracle__factory,
} from 'contracts'
import { ICurveJson } from 'build'

use(solidity)

describe('CrvBaseRateOracle', () => {
  let provider: MockProvider
  let owner: Wallet
  let crvBaseRateOracle: MockCrvBaseRateOracle
  let oracleShortCooldown: MockCrvBaseRateOracle
  let oracleLongBuffer: CrvBaseRateOracle
  let mockCurve: MockContract
  let INITIAL_TIMESTAMP
  let BUFFER_SIZE
  const MAX_BUFFER_SIZE = 365
  const COOLDOWN_TIME = DAY
  const STARTING_RATE = 100

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    provider = _provider

    mockCurve = await deployMockContract(owner, ICurveJson.abi)
    await mockCurve.mock.get_virtual_price.returns(STARTING_RATE)

    await new CrvBaseRateOracle__factory(owner)
    await new MockCrvBaseRateOracle__factory(owner)
    crvBaseRateOracle = await new MockCrvBaseRateOracle__factory(owner).deploy(mockCurve.address, COOLDOWN_TIME)
    INITIAL_TIMESTAMP = await getCurrentTimestamp()

    BUFFER_SIZE = await crvBaseRateOracle.bufferSize()
    oracleShortCooldown = await new MockCrvBaseRateOracle__factory(owner).deploy(mockCurve.address, COOLDOWN_TIME / 2)
    oracleLongBuffer = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address, COOLDOWN_TIME)
  })

  const updateBufferRightAfterCooldown = async (oracle: CrvBaseRateOracle | MockCrvBaseRateOracle) => {
    const bufferSize = await oracle.bufferSize()
    const [, timestamps, insertIndex] = await oracle.getTotalsBuffer()
    const newestTimestamp = timestamps[(insertIndex + bufferSize) % bufferSize].toNumber()
    await timeTravelTo(provider, newestTimestamp + COOLDOWN_TIME)
    await oracle.update()
  }

  const getCurrentTimestamp = async () => {
    return (await provider.getBlock('latest')).timestamp
  }

  describe('Constructor', () => {
    it('correctly sets fields', async () => {
      expect(await crvBaseRateOracle.curve()).to.eq(mockCurve.address)
      expect(await crvBaseRateOracle.cooldownTime()).to.eq(COOLDOWN_TIME)
    })

    it('fills up one field in historical buffer', async () => {
      const [, timestamps] = await crvBaseRateOracle.getTotalsBuffer()
      expect(timestamps[0]).to.eq(INITIAL_TIMESTAMP)
    })
  })

  describe('RunningTotalsBuffer', () => {
    it('has expected capacity', async () => {
      const [runningTotals, timestamps] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals.length).to.eq(MAX_BUFFER_SIZE)
      expect(timestamps.length).to.eq(MAX_BUFFER_SIZE)
    })

    it('has expected initial insert index of 0', async () => {
      const [, , latestIndex] = await crvBaseRateOracle.getTotalsBuffer()
      expect(latestIndex).to.eq(0)
    })

    it('insertIndex increments cyclically', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < BUFFER_SIZE - 1; i++) {
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        const [, , latestIndex] = await crvBaseRateOracle.getTotalsBuffer()
        expect(latestIndex).to.eq(i + 1)
      }
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      const [, , latestIndex] = await crvBaseRateOracle.getTotalsBuffer()
      expect(latestIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
      }
      let [runningTotals] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(8640100)
      await mockCurve.mock.get_virtual_price.returns(200)
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      ;[runningTotals] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(73440850)
    })
  })

  describe('update', () => {
    it('reverts if cooldown is on', async () => {
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      await expect(crvBaseRateOracle.update())
        .to.be.revertedWith('CrvBaseRateOracle: Buffer on cooldown')
      await timeTravel(provider, COOLDOWN_TIME)
      await expect(crvBaseRateOracle.update())
        .not.to.be.reverted
    })

    it('adds one rate to buffer', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      const curTimestamp = await getCurrentTimestamp()
      const [runningTotals, timestamps, latestIndex] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(8640100)
      expect(timestamps[1]).to.eq(curTimestamp)
      expect(latestIndex).to.eq(1)
    })
  })

  describe('calculateAverageRate', () => {
    describe('reverts if', () => {
      it('provided timeToCover is either too small or too large', async () => {
        await expect(crvBaseRateOracle.calculateAverageRate(DAY - 1))
          .to.be.revertedWith('CrvBaseRateOracle: Expected amount of time in range 1 to 365 days')
        await expect(crvBaseRateOracle.calculateAverageRate(365 * DAY + 1))
          .to.be.revertedWith('CrvBaseRateOracle: Expected amount of time in range 1 to 365 days')
      })

      it('size of buffer does not match provided timeToCover', async () => {
        const badTimeAmount = (BUFFER_SIZE + 1) * COOLDOWN_TIME / 2
        await expect(oracleShortCooldown.calculateAverageRate(badTimeAmount))
          .to.be.revertedWith('CrvBaseRateOracle: Needed buffer size cannot exceed size limit')
      })
    })

    describe('calculates the rate correctly', () => {
      it('before any update call', async () => {
        expect(await crvBaseRateOracle.calculateAverageRate(DAY)).to.eq(100_0000)
      })

      it('with partially overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(100)
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(200)
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        // Curve virtual prices: 100, 100, 200 probed with 1 day interval
        // Expected value is 250/2 = 125
        expectCloseTo(await crvBaseRateOracle.calculateAverageRate(3 * DAY), BigNumber.from(125_0000), 5)
      })

      it('with overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
        }
        await mockCurve.mock.get_virtual_price.returns(300)
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        // Curve virtual prices: 200, 300, 200, 200, 200, 200, 200 probed with 1 day interval
        // Expected value is 1250/6 = 208.(3)
        expectCloseTo(await crvBaseRateOracle.calculateAverageRate(7 * DAY), BigNumber.from(Math.floor(1250 / 6 * 10000)), 5)
      })

      it('when current price has non-zero time weight', async () => {
        await mockCurve.mock.get_virtual_price.returns(100)
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(200)
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(300)
        await timeTravel(provider, DAY / 2)
        // Curve virtual prices: 100, 100, 200 probed with 1 day interval
        // Expected value is (250 + 250 / 2) / 2.5 = 150
        expectCloseTo(await crvBaseRateOracle.calculateAverageRate(3 * DAY), BigNumber.from(150_0000), 5)
      })
    })

    describe('getWeeklyAPY', () => {
      describe('returns correct value if', () => {
        it('prices grows for last 3 days', async () => {
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(300)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(400)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await timeTravel(provider, DAY / 2)
          // Curve virtual prices: 400, 100, 100, 100, 100, 200, 300 probed with 1 day interval
          // Expected avg rate is (1050 + 400 / 2) / 6.5 = 192.3076
          // Expected weekly apy is (400 - 192.3076) / 192.3076 = 1.08..
          expectCloseTo(await crvBaseRateOracle.calculateAverageRate(7 * DAY), BigNumber.from(192_3076), 5)
          expect(await crvBaseRateOracle.getWeeklyAPY()).to.eq(108_00)
        })

        it('price goes up and down', async () => {
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(100)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(150)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(300)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(250)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await timeTravel(provider, DAY / 2)
          // Curve virtual prices: 250, 200, 100, 150, 200, 300, 200 probed with 1 day interval
          // Expected avg rate is (1175 + 250 / 2) / 6.5 = 200.00
          // Expected weekly apy is (250 - 200) / 200 = 0.25
          expectCloseTo(await crvBaseRateOracle.calculateAverageRate(7 * DAY), BigNumber.from(200_0000), 5)
          expect(await crvBaseRateOracle.getWeeklyAPY()).to.eq(25_00)
        })

        it('prices goes down', async () => {
          await mockCurve.mock.get_virtual_price.returns(50)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          // Curve virtual prices: 100, 50 probed with 1 day interval
          // Expected avg rate is 75 / 1 = 75
          // Expected weekly apy is (50 - 75) / 75 = -0.(3)
          expectCloseTo(await crvBaseRateOracle.calculateAverageRate(2 * DAY), BigNumber.from(75_0000), 5)
          expect(await crvBaseRateOracle.getWeeklyAPY()).to.eq(-33_33)
        })
      })
    })

    describe('getMonthlyAPY', () => {
      it('correctly calculates APY', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 30; i++) {
          await mockCurve.mock.get_virtual_price.returns(100 + i * 10)
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Curve virtual prices: 100, 110, ..., 390 probed with 1 day interval
        // Expected avg rate is 245
        // Expected monthly apy is 59.18
        expect(await oracleLongBuffer.getMonthlyAPY()).to.eq(59_18)
      })
    })

    describe('getYearlyAPY', () => {
      xit('correctly calculates APY', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockCurve.mock.get_virtual_price.returns(100 + i * 10)
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Curve virtual prices: 100, 110, ..., 3740 probed with 1 day interval
        // Expected avg rate is 1920
        // Expected yearly apy is 94.79
        expect(await oracleLongBuffer.getYearlyAPY()).to.eq(94_79)
      }).timeout(100_000)
    })
  })
})
