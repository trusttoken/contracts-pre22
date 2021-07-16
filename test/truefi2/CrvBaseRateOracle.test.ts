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

const BN = (number: number) => (BigNumber.from(BigInt(number)))

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
  const STARTING_RATE = BN(1e18)

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
    const [, timestamps, latestIndex] = await oracle.getTotalsBuffer()
    const newestTimestamp = timestamps[latestIndex].toNumber()
    await timeTravelTo(provider, newestTimestamp + COOLDOWN_TIME - 1)
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
      await mockCurve.mock.get_virtual_price.returns(BN(1e18))
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
      await mockCurve.mock.get_virtual_price.returns(BN(1e18))
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
      }
      let [runningTotals] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(BN(86400e18))
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      ;[runningTotals] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(BN(691200e18))
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
      await mockCurve.mock.get_virtual_price.returns(BN(1e18))
      await updateBufferRightAfterCooldown(crvBaseRateOracle)
      const curTimestamp = await getCurrentTimestamp()
      const [runningTotals, timestamps, latestIndex] = await crvBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(BN(86400e18))
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
        expect(await crvBaseRateOracle.calculateAverageRate(DAY)).to.eq(BN(1e18))
      })

      it('with partially overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(BN(1e18))
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(BN(2e18))
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        // Curve virtual prices: 1.0, 1.0, 2.0 probed with 1 day interval
        // Expected value is 2.5/2 = 1.25
        expect(await crvBaseRateOracle.calculateAverageRate(3 * DAY)).to.eq(BN(1_25e16))
      })

      it('with overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(BN(2e18))
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
        }
        await mockCurve.mock.get_virtual_price.returns(BN(3e18))
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        // Curve virtual prices: 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 12.5 / 6 = 2.08(3)
        expectCloseTo(await crvBaseRateOracle.calculateAverageRate(7 * DAY), BN(Math.floor(1250 / 6 * 1e16)), 1e8)
      })

      it('when current price has non-zero time weight', async () => {
        await mockCurve.mock.get_virtual_price.returns(BN(1e18))
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(BN(2e18))
        await updateBufferRightAfterCooldown(crvBaseRateOracle)
        await mockCurve.mock.get_virtual_price.returns(BN(3e18))
        await timeTravel(provider, DAY / 2 - 1)
        // Curve virtual prices: 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 1.5 + 2.5 / 2) / 2.5 = 1.5
        expect(await crvBaseRateOracle.calculateAverageRate(3 * DAY)).to.eq(BN(1_50e16))
      })
    })

    describe('getWeeklyAPR', () => {
      describe('returns correct value if', () => {
        it('prices grows for last 3 days', async () => {
          await mockCurve.mock.get_virtual_price.returns(BN(1e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(2e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(3e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(4e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await timeTravel(provider, DAY / 2)
          // Curve virtual prices: 1.0, 1.0, 1.0, 2.0, 3.0, 4.0 probed with 1 day interval
          // Expected avg rate is (1.0 * 3 + 1.5 + 2.5 + 3.5 + 4 / 2) / 6.5 = 1.(923076)
          // Expected weekly apr is (4.0 - 1.9230) / 1.9230 / (7 days / 365 days) = 56.3142
          expectCloseTo(await crvBaseRateOracle.calculateAverageRate(7 * DAY), BN(1_9230769230e8), 1e8)
          expect(await crvBaseRateOracle.getWeeklyAPR()).to.eq(56_3142)
        })

        it('price goes up and down', async () => {
          await mockCurve.mock.get_virtual_price.returns(BN(2e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(1e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(1_5e17))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(2e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(3e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(2e18))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await mockCurve.mock.get_virtual_price.returns(BN(2_5e17))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          await timeTravel(provider, DAY / 2)
          // Curve virtual prices: 2.5, 2.0, 1.0, 1.5, 2.0, 3.0, 2.0 probed with 1 day interval
          // Expected avg rate is (11.75 + 2.5 / 2) / 6.5 = 2.0
          // Expected weekly apr is (2.50 - 2.0) / 2.0 / (7 days / 365 days) = 13.0357
          expect(await crvBaseRateOracle.calculateAverageRate(7 * DAY)).to.eq(BN(2e18))
          expect(await crvBaseRateOracle.getWeeklyAPR()).to.eq(Math.floor(13_0357))
        })

        it('prices goes down', async () => {
          await mockCurve.mock.get_virtual_price.returns(BN(5e17))
          await updateBufferRightAfterCooldown(crvBaseRateOracle)
          // Curve virtual prices: 1.0, 0.5 probed with 1 day interval
          // Expected avg rate is 0.75 / 1 = 0.75
          // Expected weekly apr is (0.50 - 0.75) / 0.75 / (7 / 365) = -17.3809..
          expect(await crvBaseRateOracle.calculateAverageRate(2 * DAY)).to.eq(BN(75e16))
          expect(await crvBaseRateOracle.getWeeklyAPR()).to.eq(-17_3809)
        })
      })
    })

    describe('getMonthlyAPR', () => {
      it('correctly calculates apr', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 30; i++) {
          await mockCurve.mock.get_virtual_price.returns(BN(1e18 + i * 1e17))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Curve virtual prices: 1.0, 1.1, ..., 3.9 probed with 1 day interval
        // Expected avg rate is 2.45..
        // Expected monthly apr is 7.2006..
        expect(await oracleLongBuffer.getMonthlyAPR()).to.eq(7_2006)
      })
    })

    describe('getYearlyAPR', () => {
      xit('correctly calculates apr', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockCurve.mock.get_virtual_price.returns(BN(1e18 + i * 1e17))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Curve virtual prices: 1, 1.1, ..., 3.74 probed with 1 day interval
        // Expected avg rate is 1.92
        // Expected yearly apr is 0.9479
        expect(await oracleLongBuffer.getYearlyAPR()).to.eq(9479)
      }).timeout(100_000)
    })
  })
})
