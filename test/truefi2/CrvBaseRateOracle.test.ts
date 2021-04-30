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
  let bufferSize

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner] = wallets
    mockCurve = await deployMockContract(owner, ICurveJson.abi)

    crvBaseRateOracle = await new CrvBaseRateOracle__factory(owner).deploy(mockCurve.address)
    bufferSize = await crvBaseRateOracle.BUFFER_SIZE()
    provider = _provider
  })

  describe('Constructor', () => {
    it('correctly sets curve interface', async () => {
      expect(await crvBaseRateOracle.curve()).to.eq(mockCurve.address)
    })
  })

  describe('HistoricalRatesBuffer', () => {
    it('initial buffer size', async () => {
      const [baseRates, timestamps, insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(baseRates.length).to.eq(bufferSize)
      expect(timestamps.length).to.eq(bufferSize)
      expect(insertIndex).to.eq(0)
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
      for (let _ = 0; _ < (bufferSize-1); _++) {
        await crvBaseRateOracle.updateRate()
      }
      let [_, __, insertIndex] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(6)
      await crvBaseRateOracle.updateRate()
      ;[ _, __, insertIndex ] = await crvBaseRateOracle.getHistBuffer()
      expect(insertIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let _ = 0; _ < bufferSize; _++) {
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

  const fillHistoricalBuffer = async () => {
    let buffer = {
      rates: [],
      timestamps: []
    }
    const initialRate = 100
    for (let i = 0; i < bufferSize; i++) {
      const rate = initialRate + i * 20
      await mockCurve.mock.get_virtual_price.returns(rate)
      const curTimestamp = (await provider.getBlock('latest')).timestamp
      await crvBaseRateOracle.updateRate()
      buffer.rates.push(rate)
      buffer.timestamps.push(curTimestamp)
      await timeTravelTo(provider, curTimestamp + DAY)
    }
    return [buffer, initialRate + (bufferSize - 1) * 20]
  }

  const calcAvgRate = (buffer, insertIndex: number) => {
    const v_n = buffer.rates[(insertIndex - 1 + bufferSize) % bufferSize]
    const v_1 = buffer.rates[insertIndex]
    const t_n = buffer.timestamps[(insertIndex - 1 + bufferSize) % bufferSize]
    const t_1 = buffer.timestamps[insertIndex]
    return Math.round((v_n - v_1) * 100_00 / (t_n - t_1))
  }

  describe('calculateAverageRate', () => {
    describe('calculates the rate correctly if', () => {
      it('histBuffer is not filled up', async () => {
        await mockCurve.mock.get_virtual_price.returns(100)
        await crvBaseRateOracle.updateRate()
        await crvBaseRateOracle.updateRate()
        expect(await crvBaseRateOracle.calculateAverageRate()).to.eq(0)
      })

      it('histBuffer is filled up', async () => {
        const [buffer] = await fillHistoricalBuffer()
        const expected = calcAvgRate(buffer, 0)
        expect(await crvBaseRateOracle.calculateAverageRate()).to.eq(expected)
      })
    })
  })

  describe('rate', () => {
    it('reverts if histBuffer is not filled up', async () => {
      await expect(crvBaseRateOracle.rate())
        .to.be.revertedWith('CrvBaseRateOracle: histBuffer must be filled up')
      await mockCurve.mock.get_virtual_price.returns(100)
      for (let _ = 0; _ < (bufferSize-1); _++) {
        await crvBaseRateOracle.updateRate()
      }
      await expect(crvBaseRateOracle.rate())
        .to.be.revertedWith('CrvBaseRateOracle: histBuffer must be filled up')
      await crvBaseRateOracle.updateRate()
      await expect(crvBaseRateOracle.rate())
        .not.to.be.reverted
    })

    it('successfully returns weekly, monthly, yearly values', async () => {
      const [buffer, curRate] = await fillHistoricalBuffer()
      const immediateProfit = Math.round(calcAvgRate(buffer, 0))
      expect(await crvBaseRateOracle.rate())
        .to.deep.equal(
          [7 * DAY, 30 * DAY, 365 * DAY].map(x => BigNumber.from( immediateProfit).mul(x).div(curRate))
        )
    })
  })
})
