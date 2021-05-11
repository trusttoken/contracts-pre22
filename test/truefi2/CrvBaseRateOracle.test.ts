import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { DAY, timeTravel, timeTravelTo } from 'utils'

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
  let oracleShortCooldown: CrvBaseRateOracle
  let mockCurve: MockContract
  let BUFFER_SIZE
  let DEPLOYMENT_TIMESTAMP
  const COOLDOWN_TIME = DAY
  // values historical buffer is prefilled with
  const STARTING_RATE = 100

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    provider = _provider

    mockCurve = await deployMockContract(owner, ICurveJson.abi)
    await mockCurve.mock.get_virtual_price.returns(STARTING_RATE)

    crvBaseRateOracle = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address, COOLDOWN_TIME)
    DEPLOYMENT_TIMESTAMP = await getCurrentTimestamp()

    BUFFER_SIZE = await crvBaseRateOracle.BUFFER_SIZE()
    oracleShortCooldown = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address, COOLDOWN_TIME / 2)
  })

  const updateRateRightAfterCooldown = async () => {
    const [, timestamps, insertIndex] = await crvBaseRateOracle.getHistBuffer()
    const newestTimestamp = timestamps[(insertIndex + BUFFER_SIZE - 1) % BUFFER_SIZE].toNumber()
    await timeTravelTo(provider, newestTimestamp + COOLDOWN_TIME)
    await crvBaseRateOracle.updateRate()
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
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(0)
      expect(timestamps[0]).to.eq(0)
      expect(baseRates[BUFFER_SIZE - 1]).to.eq(STARTING_RATE)
      expect(timestamps[BUFFER_SIZE - 1]).to.eq(DEPLOYMENT_TIMESTAMP)
    })
  })

  describe('HistoricalRatesBuffer', () => {
    it('has expected length', async () => {
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates.length).to.eq(BUFFER_SIZE)
      expect(timestamps.length).to.eq(BUFFER_SIZE)
    })

    it('has expected initial insert index', async () => {
      const [, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(0)
    })

    it('insertIndex increments cyclically', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < (BUFFER_SIZE - 1); i++) {
        await updateRateRightAfterCooldown()
      }
      let [, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(BUFFER_SIZE - 1)
      await updateRateRightAfterCooldown()
      ;[, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateRateRightAfterCooldown()
      }
      let [baseRates] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(100)
      await mockCurve.mock.get_virtual_price.returns(200)
      await updateRateRightAfterCooldown()
      ;[baseRates] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(200)
    })
  })

  describe('updateRate', () => {
    it('reverts if cooldown is on', async () => {
      await updateRateRightAfterCooldown()
      await expect(crvBaseRateOracle.updateRate())
        .to.be.revertedWith('CrvBaseRateOracle: Buffer on cooldown')
      await timeTravel(provider, COOLDOWN_TIME)
      await expect(crvBaseRateOracle.updateRate())
        .not.to.be.reverted
    })

    it('adds one rate to buffer', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      await updateRateRightAfterCooldown()
      const curTimestamp = await getCurrentTimestamp()
      const [baseRates, timestamps, insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(100)
      expect(timestamps[0]).to.eq(curTimestamp)
      expect(insertIndex).to.eq(1)
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
      it('before any updateRate call', async () => {
        expect(await crvBaseRateOracle.calculateAverageRate(DAY)).to.eq(100 * 100_00)
      })

      it('with partially overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(100)
        await updateRateRightAfterCooldown()
        await mockCurve.mock.get_virtual_price.returns(200)
        await updateRateRightAfterCooldown()
        await mockCurve.mock.get_virtual_price.returns(300)
        const [, timestamps] = (await crvBaseRateOracle.getHistBuffer())
        const recentlyStoredTimestamp = timestamps[1].toNumber()
        const curTimestamp = await getCurrentTimestamp()
        const expected = Math.floor(
          (250 * (curTimestamp - recentlyStoredTimestamp) + 150 * DAY + 100 * DAY) * 100_00 / (curTimestamp - recentlyStoredTimestamp + 2 * DAY),
        )
        expect(await crvBaseRateOracle.calculateAverageRate(3 * DAY)).to.eq(expected)
      })

      it('with overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateRateRightAfterCooldown()
        }
        await mockCurve.mock.get_virtual_price.returns(300)
        await updateRateRightAfterCooldown()
        const [, timestamps] = (await crvBaseRateOracle.getHistBuffer())
        const recentlyStoredTimestamp = timestamps[0].toNumber()
        const curTimestamp = await getCurrentTimestamp()
        const expected = Math.floor(
          (300 * (curTimestamp - recentlyStoredTimestamp) + 250 * DAY + 200 * DAY * 5) * 100_00 / (curTimestamp - recentlyStoredTimestamp + 6 * DAY),
        )
        expect(await crvBaseRateOracle.calculateAverageRate(7 * DAY)).to.eq(expected)
      })
    })

    describe('weeklyProfit', () => {
      describe('returns correct value if', () => {
        it('prices grows for last 3 days', async () => {
          await updateRateRightAfterCooldown()
          await updateRateRightAfterCooldown()
          await updateRateRightAfterCooldown()
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(300)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(400)
          await updateRateRightAfterCooldown()
          const [, timestamps] = (await crvBaseRateOracle.getHistBuffer())
          const recentlyStoredTimestamp = timestamps[6].toNumber()
          const curTimestamp = await getCurrentTimestamp()
          const avgRate = Math.floor(
            (400 * (curTimestamp - recentlyStoredTimestamp) + 350 * DAY + 250 * DAY + 150 * DAY + 100 * 3 * DAY) * 100_00 / (curTimestamp - recentlyStoredTimestamp + 6 * DAY),
          )
          const expected = Math.floor(
            (400 * 100_00 - avgRate) * 7 * DAY / avgRate,
          )
          expect(await crvBaseRateOracle.weeklyProfit()).to.eq(expected)
        })

        it('price goes up and down', async () => {
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(100)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(150)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(300)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(200)
          await updateRateRightAfterCooldown()
          await mockCurve.mock.get_virtual_price.returns(250)
          await updateRateRightAfterCooldown()
          const [, timestamps] = (await crvBaseRateOracle.getHistBuffer())
          const recentlyStoredTimestamp = timestamps[6].toNumber()
          const curTimestamp = await getCurrentTimestamp()
          const avgRate = Math.floor(
            (250 * (curTimestamp - recentlyStoredTimestamp) + 225 * DAY + 250 * DAY + 250 * DAY + 175 * DAY + 125 * DAY + 150 * DAY) *
            100_00 / (curTimestamp - recentlyStoredTimestamp + 6 * DAY),
          )
          const expected = Math.floor(
            (250 * 100_00 - avgRate) * 7 * DAY / avgRate,
          )
          expect(await crvBaseRateOracle.weeklyProfit()).to.eq(expected)
        })

        it('prices goes down', async () => {
          await mockCurve.mock.get_virtual_price.returns(50)
          await updateRateRightAfterCooldown()
          const [, timestamps] = (await crvBaseRateOracle.getHistBuffer())
          const recentlyStoredTimestamp = timestamps[0].toNumber()
          const curTimestamp = await getCurrentTimestamp()
          const avgRate = Math.floor(
            (50 * (curTimestamp - recentlyStoredTimestamp) + 75 * DAY) * 100_00 / (curTimestamp - recentlyStoredTimestamp + DAY),
          )
          const expected = Math.floor(
            (50 * 100_00 - avgRate) * 7 * DAY / avgRate,
          )
          expect(await crvBaseRateOracle.weeklyProfit()).to.eq(expected)
        })
      })
    })
  })
})
