import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { DAY, timeTravel, timeTravelTo } from 'utils'

import {
  AaveBaseRateOracle,
  AaveBaseRateOracle__factory,
  MockAaveBaseRateOracle,
  MockAaveBaseRateOracle__factory,
} from 'contracts'
import { IAaveLendingPoolJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

const BN = (number: number) => (BigNumber.from(BigInt(number)))

describe('AaveBaseRateOracle', () => {
  let provider: MockProvider
  let owner: Wallet
  let asset: Wallet
  let aaveBaseRateOracle: MockAaveBaseRateOracle
  let oracleShortCooldown: MockAaveBaseRateOracle
  let oracleLongBuffer: AaveBaseRateOracle
  let mockAaveLendingPool: MockContract
  let INITIAL_TIMESTAMP
  let BUFFER_SIZE
  const MAX_BUFFER_SIZE = 365
  const COOLDOWN_TIME = DAY
  const STARTING_RATE = BN(1e27)

  const mockReserveData = (number: number | BigNumber | BigInt) => {
    return [0, 0, 0, number, 0, 0, 0, AddressZero, AddressZero, AddressZero, AddressZero, 0]
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, asset] = wallets
    provider = _provider

    mockAaveLendingPool = await deployMockContract(owner, IAaveLendingPoolJson.abi)
    await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(STARTING_RATE))

    await new AaveBaseRateOracle__factory(owner)
    await new MockAaveBaseRateOracle__factory(owner)
    aaveBaseRateOracle = await new MockAaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME, asset.address)
    INITIAL_TIMESTAMP = await getCurrentTimestamp()

    BUFFER_SIZE = await aaveBaseRateOracle.bufferSize()
    oracleShortCooldown = await new MockAaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME / 2, asset.address)
    oracleLongBuffer = await new AaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME, asset.address)
  })

  const updateBufferRightAfterCooldown = async (oracle: AaveBaseRateOracle | MockAaveBaseRateOracle) => {
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
      expect(await aaveBaseRateOracle.aavePool()).to.eq(mockAaveLendingPool.address)
      expect(await aaveBaseRateOracle.cooldownTime()).to.eq(COOLDOWN_TIME)
    })

    it('fills up one field in historical buffer', async () => {
      const [, timestamps] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(timestamps[0]).to.eq(INITIAL_TIMESTAMP)
    })
  })

  describe('RunningTotalsBuffer', () => {
    it('has expected capacity', async () => {
      const [runningTotals, timestamps] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals.length).to.eq(MAX_BUFFER_SIZE)
      expect(timestamps.length).to.eq(MAX_BUFFER_SIZE)
    })

    it('has expected initial insert index of 0', async () => {
      const [, , latestIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(latestIndex).to.eq(0)
    })

    it('insertIndex increments cyclically', async () => {
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
      for (let i = 0; i < BUFFER_SIZE - 1; i++) {
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        const [, , latestIndex] = await aaveBaseRateOracle.getTotalsBuffer()
        expect(latestIndex).to.eq(i + 1)
      }
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      const [, , latestIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(latestIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      }
      let [runningTotals] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(86400_0000)
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      ;[runningTotals] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(691200_0000)
    })
  })

  describe('update', () => {
    it('reverts if cooldown is on', async () => {
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      await expect(aaveBaseRateOracle.update())
        .to.be.revertedWith('AaveBaseRateOracle: Buffer on cooldown')
      await timeTravel(provider, COOLDOWN_TIME)
      await expect(aaveBaseRateOracle.update())
        .not.to.be.reverted
    })

    it('adds one rate to buffer', async () => {
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      const curTimestamp = await getCurrentTimestamp()
      const [runningTotals, timestamps, latestIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(86400_0000)
      expect(timestamps[1]).to.eq(curTimestamp)
      expect(latestIndex).to.eq(1)
    })
  })

  describe('calculateAverageRate', () => {
    describe('reverts if', () => {
      it('provided timeToCover is either too small or too large', async () => {
        await expect(aaveBaseRateOracle.calculateAverageAPY(DAY - 1))
          .to.be.revertedWith('AaveBaseRateOracle: Expected amount of time in range 1 to 365 days')
        await expect(aaveBaseRateOracle.calculateAverageAPY(365 * DAY + 1))
          .to.be.revertedWith('AaveBaseRateOracle: Expected amount of time in range 1 to 365 days')
      })

      it('size of buffer does not match provided timeToCover', async () => {
        const badTimeAmount = (BUFFER_SIZE + 1) * COOLDOWN_TIME / 2
        await expect(oracleShortCooldown.calculateAverageAPY(badTimeAmount))
          .to.be.revertedWith('AaveBaseRateOracle: Needed buffer size cannot exceed size limit')
      })
    })

    describe('calculates the rate correctly', () => {
      it('before any update call', async () => {
        expect(await aaveBaseRateOracle.calculateAverageAPY(DAY)).to.eq(1_0000)
      })

      it('with partially overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Curve virtual prices: 1.0, 1.0, 2.0 probed with 1 day interval
        // Expected value is 2.5/2 = 1.25
        expect(await aaveBaseRateOracle.calculateAverageAPY(3 * DAY)).to.eq(1_2500)
      })

      it('with overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        }
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Curve virtual prices: 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 12.5 / 6 = 2.08(3)
        expect(await aaveBaseRateOracle.calculateAverageAPY(7 * DAY)).to.eq(Math.floor(12_5000 / 6))
      })

      it('when current price has non-zero time weight', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
        await timeTravel(provider, DAY / 2)
        // Curve virtual prices: 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 1.5 + 2.5 / 2) / 2.5 = 1.5
        expect(await aaveBaseRateOracle.calculateAverageAPY(3 * DAY)).to.be.closeTo(BN(1_5000), 1)
      })
    })

    describe('getWeeklyAPY', () => {
      describe('returns correct value if', () => {
        it('prices grows for last 3 days', async () => {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(4e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await timeTravel(provider, DAY / 2)
          // Aave deposit apys (percents): 1.0, 1.0, 1.0, 2.0, 3.0, 4.0 probed with 1 day interval
          // Expected avg apy is (1.0 * 3 + 1.5 + 2.5 + 3.5 + 4 / 2) / 6.5 = 1.(923076)
          // Expected weekly apy is 1.9230
          expect(await aaveBaseRateOracle.calculateAverageAPY(7 * DAY)).to.eq(1_9230)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.eq(1_9230)
        })

        it('price goes up and down', async () => {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1_5e26)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2_5e26)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await timeTravel(provider, DAY / 2 - 1)
          // Aave deposit apys (percents): 2.0, 1.0, 1.5, 2.0, 3.0, 2.0, 2.5 probed with 1 day interval
          // Expected avg apy is (11.75 + 2.5 / 2) / 6.5 = 2.0
          // Expected weekly apy is 2.0
          expect(1).to.be.closeTo(0, 1)
          expect(await aaveBaseRateOracle.calculateAverageAPY(7 * DAY)).to.be.closeTo(BigNumber.from(2_0000), 1)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.be.closeTo(BigNumber.from(2_0000), 1)
        })

        it('prices goes down', async () => {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(5e26)))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          // Aave deposit apys (percents): 1.0, 0.5 probed with 1 day interval
          // Expected avg apy is 0.75 / 1 = 0.75
          // Expected weekly apy is 0.75
          expect(await aaveBaseRateOracle.calculateAverageAPY(2 * DAY)).to.eq(7500)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.eq(7500)
        })
      })
    })

    describe('getMonthlyAPY', () => {
      it('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 30; i++) {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27 + i * 1e26)))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Aave deposit apys (percents): 1.0, 1.1, ..., 3.9 probed with 1 day interval
        // Expected avg apy is 2.44(9)
        // Expected monthly apy is 2.44(9)
        expect(await oracleLongBuffer.getMonthlyAPY()).to.eq(2_4499)
      })
    })

    describe('getYearlyAPY', () => {
      it('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27 + i * 1e26)))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Aave deposit apys (percents): 1, 1.1, ..., 37.4 probed with 1 day interval
        // Expected avg apy is 19.2
        // Expected yearly apy is 19.2
        expect(await oracleLongBuffer.getYearlyAPY()).to.be.closeTo(BigNumber.from(19_2000), 1)
      }).timeout(100_000)
    })
  })
})
