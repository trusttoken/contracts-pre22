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
  let BUFFER_SIZE
  // values historical buffer is prefilled with
  const STARTING_RATE = 100
  let STARTING_TIMESTAMP

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    mockCurve = await deployMockContract(owner, ICurveJson.abi)
    await mockCurve.mock.get_virtual_price.returns(STARTING_RATE)

    crvBaseRateOracle = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address)
    STARTING_TIMESTAMP = (await _provider.getBlock('latest')).timestamp
    BUFFER_SIZE = await crvBaseRateOracle.BUFFER_SIZE()

    provider = _provider
  })

  describe('Constructor', () => {
    it('correctly sets curve interface', async () => {
      expect(await crvBaseRateOracle.curve()).to.eq(mockCurve.address)
    })

    it('fills up historical buffer', async () => {
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates).to.deep.eq(Array(BUFFER_SIZE).fill(BigNumber.from(STARTING_RATE)))
      const curTimestamp = (await provider.getBlock('latest')).timestamp
      expect(timestamps).to.deep.eq(Array(BUFFER_SIZE).fill(BigNumber.from(curTimestamp)))
    })
  })

  describe('HistoricalRatesBuffer', () => {
    it('initial buffer size', async () => {
      const [baseRates, timestamps] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates.length).to.eq(BUFFER_SIZE)
      expect(timestamps.length).to.eq(BUFFER_SIZE)
    })

    it('adds one rate to buffer', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      await crvBaseRateOracle.updateRate()
      const curTimestamp = (await provider.getBlock('latest')).timestamp
      const [baseRates, timestamps, insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(100)
      expect(timestamps[0]).to.eq(curTimestamp)
      expect(insertIndex).to.eq(1)
    })

    it('insertIndex increments cyclically', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < (BUFFER_SIZE - 1); i++) {
        await crvBaseRateOracle.updateRate()
      }
      let [, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(6)
      await crvBaseRateOracle.updateRate()
      ;[, , insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await crvBaseRateOracle.updateRate()
      }
      let [baseRates] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(100)
      await mockCurve.mock.get_virtual_price.returns(200)
      await crvBaseRateOracle.updateRate()
      ;[baseRates] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates[0]).to.eq(200)
    })
  })

  describe('calculateAverageRate', () => {
    describe('calculates the rate correctly', () => {
      it('with prefilled buffer', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        await crvBaseRateOracle.updateRate()
        await timeTravelTo(provider, STARTING_TIMESTAMP + 60)
        expect(await crvBaseRateOracle.calculateAverageRate())
          .to.eq((BigNumber.from(200 - STARTING_RATE)).mul(100_00).div(60))
      })

      it('with manually added rates', async () => {
        await mockCurve.mock.get_virtual_price.returns(200)
        const t_1 = (await provider.getBlock('latest')).timestamp
        for (let i = 0; i < 6; i++) {
          await crvBaseRateOracle.updateRate()
        }
        await mockCurve.mock.get_virtual_price.returns(400)
        const t_n = (await provider.getBlock('latest')).timestamp
        await crvBaseRateOracle.updateRate()
        expect(await crvBaseRateOracle.calculateAverageRate())
          .to.eq(BigNumber.from(400 - 200).mul(100_00).div(t_n - t_1))
      })
    })
  })

  describe('rate', () => {
    it('successfully returns weekly, monthly, yearly values', async () => {
      await mockCurve.mock.get_virtual_price.returns(200)
      const t_1 = (await provider.getBlock('latest')).timestamp
      for (let i = 0; i < 6; i++) {
        await crvBaseRateOracle.updateRate()
      }
      await mockCurve.mock.get_virtual_price.returns(400)
      const t_n = (await provider.getBlock('latest')).timestamp
      await crvBaseRateOracle.updateRate()
      const avgRate = BigNumber.from(400 - 200).mul(100_00).div(t_n - t_1)
      expect(await crvBaseRateOracle.rate())
        .to.deep.equal(
          [7 * DAY, 30 * DAY, 365 * DAY].map(x => avgRate.mul(x).div(BigNumber.from(400))),
        )
    })
  })
})
