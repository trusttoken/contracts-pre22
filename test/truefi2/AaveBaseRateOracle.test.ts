import { expect, use } from 'chai'
import { solidity, deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { DAY, timeTravel, timeTravelTo } from 'utils'

import {
  AaveBaseRateOracle,
  AaveBaseRateOracle__factory,
  TestAaveBaseRateOracle,
  TestAaveBaseRateOracle__factory,
} from 'contracts'
import { IAaveLendingPoolJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('AaveBaseRateOracle', () => {
  let provider: MockProvider
  let owner: Wallet
  let asset: Wallet
  let aaveBaseRateOracle: TestAaveBaseRateOracle
  let oracleShortCooldown: TestAaveBaseRateOracle
  let oracleLongBuffer: AaveBaseRateOracle
  let mockAaveLendingPool: MockContract
  let INITIAL_TIMESTAMP
  let BUFFER_SIZE
  const MAX_BUFFER_SIZE = 365 + 1
  const COOLDOWN_TIME = DAY

  const mockReserveData = (number: number | BigNumber) => {
    return [0, 0, 0, 0, BigNumber.from(10).pow(27).mul(number), 0, 0, AddressZero, AddressZero, AddressZero, AddressZero, 0]
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, asset] = wallets
    provider = _provider

    mockAaveLendingPool = await deployMockContract(owner, IAaveLendingPoolJson.abi)
    await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))

    await new AaveBaseRateOracle__factory(owner)
    await new TestAaveBaseRateOracle__factory(owner)
    aaveBaseRateOracle = await new TestAaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME, asset.address)
    INITIAL_TIMESTAMP = await getCurrentTimestamp()

    BUFFER_SIZE = await aaveBaseRateOracle.bufferSize()
    oracleShortCooldown = await new TestAaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME / 2, asset.address)
    oracleLongBuffer = await new AaveBaseRateOracle__factory(owner).deploy(mockAaveLendingPool.address, COOLDOWN_TIME, asset.address)
  })

  const updateBufferRightAfterCooldown = async (oracle: AaveBaseRateOracle | TestAaveBaseRateOracle) => {
    const [, timestamps, currIndex] = await oracle.getTotalsBuffer()
    const newestTimestamp = timestamps[currIndex].toNumber()
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

    it('has expected initial current index of 0', async () => {
      const [, , currIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(currIndex).to.eq(0)
    })

    it('insertIndex increments cyclically', async () => {
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
      for (let i = 0; i < BUFFER_SIZE - 1; i++) {
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        const [, , currIndex] = await aaveBaseRateOracle.getTotalsBuffer()
        expect(currIndex).to.eq(i + 1)
      }
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      const [, , currIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(currIndex).to.eq(0)
    })

    it('overwrites old values with new ones', async () => {
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
      for (let i = 0; i < BUFFER_SIZE; i++) {
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      }
      let [runningTotals] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(86400_0000)
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      ;[runningTotals] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(777600_0000)
    })
  })

  describe('isOffCooldown', () => {
    beforeEach(async () => {
      await timeTravelTo(provider, INITIAL_TIMESTAMP + COOLDOWN_TIME)
    })

    it('returns true if cooldown is off', async () => {
      expect(await aaveBaseRateOracle.isOffCooldown()).to.be.true
      await aaveBaseRateOracle.update()
      await timeTravel(provider, COOLDOWN_TIME)
      expect(await aaveBaseRateOracle.isOffCooldown()).to.be.true
    })

    it('returns false if cooldown is on', async () => {
      await aaveBaseRateOracle.update()
      expect(await aaveBaseRateOracle.isOffCooldown()).to.be.false
      await timeTravel(provider, COOLDOWN_TIME - 1)
      expect(await aaveBaseRateOracle.isOffCooldown()).to.be.false
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
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
      await updateBufferRightAfterCooldown(aaveBaseRateOracle)
      const curTimestamp = await getCurrentTimestamp()
      const [runningTotals, timestamps, currIndex] = await aaveBaseRateOracle.getTotalsBuffer()
      expect(runningTotals[1]).to.eq(86400_0000)
      expect(timestamps[1]).to.eq(curTimestamp)
      expect(currIndex).to.eq(1)
    })
  })

  describe('calculateAverageRate', () => {
    describe('reverts if', () => {
      it('numberOfValues equals 0', async () => {
        await expect(oracleShortCooldown.calculateAverageAPY(0))
          .to.be.revertedWith('AaveBaseRateOracle: Number of values should be greater than 0')
      })

      it('numberOfValues is not less than buffer size', async () => {
        let numberOfValues = BUFFER_SIZE + 1
        await expect(oracleShortCooldown.calculateAverageAPY(numberOfValues))
          .to.be.revertedWith('AaveBaseRateOracle: Number of values should be less than buffer size')
        numberOfValues = BUFFER_SIZE
        await expect(oracleShortCooldown.calculateAverageAPY(numberOfValues))
          .to.be.revertedWith('AaveBaseRateOracle: Number of values should be less than buffer size')
      })
    })

    describe('calculates the rate correctly', () => {
      it('before any update call', async () => {
        await expect(aaveBaseRateOracle.calculateAverageAPY(2))
          .to.be.revertedWith('AaveBaseRateOracle: There are fewer values stored than required')
      })

      it('with partially overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 1.0, 2.0 probed with 1 day interval
        // Expected value is 3/2 = 1.5
        expect(await aaveBaseRateOracle.calculateAverageAPY(2)).to.eq(1_5000)
      })

      it('with overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        }
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(3))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 15 / 7 = 2.(142857)
        expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.eq(2_1428)
      })

      it('spot apy value has no impact on average apy', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(3))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 2.0 + 3.0) / 3 = 2.0
        expect(await aaveBaseRateOracle.calculateAverageAPY(3)).to.eq(2_0000)
      })
    })

    describe('getWeeklyAPY', () => {
      describe('returns correct value if', () => {
        it('apy grows', async () => {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(3))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(4))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          // Aave variable borrow apys (percents): 1.0, 1.0, 1.0, 1.0, 2.0, 3.0, 4.0 probed with 1 day interval
          // Expected avg apy is (1.0 * 3 + 2.0 * 2 + 3.0 + 4.0) / 7 = 2.0
          // Expected weekly apy is 2.0
          expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.eq(2_0000)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.eq(2_0000)
        })

        it('apy goes up and down', async () => {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(3))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(3))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(2))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(1))
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
          // Aave variable borrow apys (percents): 2.0, 1.0, 3, 2.0, 3.0, 2.0, 1.0 probed with 1 day interval
          // Expected avg apy is 14 / 7 = 2.0
          // Expected weekly apy is 2.0
          expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.eq(2_0000)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.eq(2_0000)
        })
      })
    })

    describe('getMonthlyAPY', () => {
      it('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 30; i++) {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(10 + i))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Aave variable borrow apys (percents): 10, 11, ..., 39 probed with 1 day interval
        // Expected avg apy is 24.5
        // Expected monthly apy is 24.5
        expect(await oracleLongBuffer.getMonthlyAPY()).to.eq(24_5000)
      })
    })

    describe('getYearlyAPY', () => {
      xit('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(10 + i))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Aave variable borrow apys (percents): 10, 11, ..., 374 probed with 1 day interval
        // Expected avg apy is 192
        // Expected yearly apy is 192
        expect(await oracleLongBuffer.getYearlyAPY()).to.eq(192_0000)
      }).timeout(100_000)
    })
  })
})
