import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
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
  let mockCurve: MockContract
  let cooldownTime
  let BUFFER_SIZE
  // values historical buffer is prefilled with
  const STARTING_RATE = 100

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    provider = _provider

    mockCurve = await deployMockContract(owner, ICurveJson.abi)
    await mockCurve.mock.get_virtual_price.returns(STARTING_RATE)

    crvBaseRateOracle = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address)
    BUFFER_SIZE = await crvBaseRateOracle.BUFFER_SIZE()
    cooldownTime = (await crvBaseRateOracle.cooldownTime()).toNumber()
  })

  const updateRateRightAfterCooldown = async () => {
    const [, timestamps, insertIndex] = await crvBaseRateOracle.getHistBuffer()
    const newestTimestamp = timestamps[(insertIndex + BUFFER_SIZE - 1) % BUFFER_SIZE].toNumber()
    await timeTravelTo(provider, newestTimestamp + cooldownTime)
    await crvBaseRateOracle.updateRate()
  }

  const getCurrentTimestamp = async () => {
    return (await provider.getBlock('latest')).timestamp
  }

  describe('Constructor', () => {
    it('correctly sets curve interface', async () => {
      expect(await crvBaseRateOracle.curve()).to.eq(mockCurve.address)
    })

    it('fills up historical buffer', async () => {
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates).to.deep.eq(Array(BUFFER_SIZE).fill(BigNumber.from(STARTING_RATE)))
      const curTimestamp = await getCurrentTimestamp()
      const timestampsExpected = [BigNumber.from(curTimestamp - 1)].concat(
        Array(BUFFER_SIZE - 1).fill(BigNumber.from(curTimestamp)),
      )
      expect(timestamps).to.deep.eq(timestampsExpected)
    })
  })

  describe('HistoricalRatesBuffer', () => {
    it('initial buffer size', async () => {
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates.length).to.eq(BUFFER_SIZE)
      expect(timestamps.length).to.eq(BUFFER_SIZE)
    })

    it('insertIndex increments cyclically', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < (BUFFER_SIZE - 1); i++) {
        await updateRateRightAfterCooldown()
      }
      let [, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(6)
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
      await timeTravel(provider, cooldownTime)
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
    describe('calculates the rate correctly', () => {
      it('with prefilled buffer', async () => {
        expect(await crvBaseRateOracle.calculateAverageRate())
          .to.eq((BigNumber.from(STARTING_RATE)).mul(100_00).div(1))
      })

      it('with partially overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        await updateRateRightAfterCooldown()
        await updateRateRightAfterCooldown()
        const expected = (200 * DAY + 200 * DAY) * 100_00 / (2 * DAY)
        expect(await crvBaseRateOracle.calculateAverageRate()).to.eq(expected)
      })

      it('with overwritten buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateRateRightAfterCooldown()
        }
        const expectedAverageRate = 200 * DAY * (BUFFER_SIZE - 1) * 100_00 / (DAY * (BUFFER_SIZE - 1))
        expect(await crvBaseRateOracle.calculateAverageRate()).to.eq(expectedAverageRate)
      })
    })
  })
})
