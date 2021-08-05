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

const BN = (number: number) => (BigNumber.from(BigInt(number)))

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
  const MAX_BUFFER_SIZE = 365
  const COOLDOWN_TIME = DAY
  const STARTING_RATE = BN(1e27)

  const mockReserveData = (number: number | BigNumber | BigInt) => {
    return [0, 0, 0, 0, number, 0, 0, AddressZero, AddressZero, AddressZero, AddressZero, 0]
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, asset] = wallets
    provider = _provider

    mockAaveLendingPool = await deployMockContract(owner, IAaveLendingPoolJson.abi)
    await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(STARTING_RATE))

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
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
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
      await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
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
      it('numberOfValues equals 1', async () => {
        const numberOfUpdates = 1
        await expect(oracleShortCooldown.calculateAverageAPY(numberOfUpdates))
          .to.be.revertedWith('AaveBaseRateOracle: Number of values should be greater than 1')
      })

      it('numberOfValues is greater than buffer size', async () => {
        const numberOfValues = BUFFER_SIZE + 1
        await expect(oracleShortCooldown.calculateAverageAPY(numberOfValues))
          .to.be.revertedWith('AaveBaseRateOracle: Number of values is limited by buffer size')
      })
    })

    describe('calculates the rate correctly', () => {
      it('before any update call', async () => {
        await expect(aaveBaseRateOracle.calculateAverageAPY(2))
          .to.be.revertedWith('AaveBaseRateOracle: There are fewer values stored than required')
      })

      it('with partially overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 1.0, 2.0 probed with 1 day interval
        // Expected value is 3/2 = 1.5
        expect(await aaveBaseRateOracle.calculateAverageAPY(3)).to.eq(1_5000)
      })

      it('with overwritten buffer', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        for (let i = 0; i < BUFFER_SIZE; i++) {
          await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        }
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 2.0, 2.0, 2.0, 2.0, 2.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is 13 / 6 = 2.1(6)
        expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.eq(2_1666)
      })

      it('spot apy value has no impact on average apy', async () => {
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(2e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(3e27)))
        await updateBufferRightAfterCooldown(aaveBaseRateOracle)
        // Aave variable borrow apys (percents): 1.0, 2.0, 3.0 probed with 1 day interval
        // Expected value is (1.0 + 2.0 + 3.0) / 3 = 2.0
        expect(await aaveBaseRateOracle.calculateAverageAPY(4)).to.be.closeTo(BN(2_0000), 1)
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
          // Aave variable borrow apys (percents): 1.0, 1.0, 1.0, 2.0, 3.0, 4.0 probed with 1 day interval
          // Expected avg apy is (1.0 * 3 + 2.0 + 3.0 + 4.0) / 6 = 2.0
          // Expected weekly apy is 2.0
          expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.be.closeTo(BN(2_0000), 1)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.be.closeTo(BN(2_0000), 1)
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
          // Aave variable borrow apys (percents): 2.0, 1.0, 1.5, 2.0, 3.0, 2.0, 2.5 probed with 1 day interval
          // Expected avg apy is 14 / 7 = 2.0
          // Expected weekly apy is 2.0
          expect(await aaveBaseRateOracle.calculateAverageAPY(7)).to.be.closeTo(BigNumber.from(2_0000), 1)
          expect(await aaveBaseRateOracle.getWeeklyAPY()).to.be.closeTo(BigNumber.from(2_0000), 1)
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
        // Aave variable borrow apys (percents): 1.0, 1.1, ..., 3.9 probed with 1 day interval
        // Expected avg apy is 2.5
        // Expected monthly apy is 2.5
        expect(await oracleLongBuffer.getMonthlyAPY()).to.be.closeTo(BN(2_5000), 1)
      })
    })

    describe('getYearlyAPY', () => {
      xit('correctly calculates apy', async () => {
        await updateBufferRightAfterCooldown(oracleLongBuffer)
        await updateBufferRightAfterCooldown(oracleLongBuffer)

        for (let i = 0; i < 365; i++) {
          await mockAaveLendingPool.mock.getReserveData.returns(...mockReserveData(BN(1e27 + i * 1e26)))
          await updateBufferRightAfterCooldown(oracleLongBuffer)
        }
        // Aave variable borrow apys (percents): 1, 1.1, ..., 37.4 probed with 1 day interval
        // Expected avg apy is 19.25
        // Expected yearly apy is 19.25
        expect(await oracleLongBuffer.getYearlyAPY()).to.be.closeTo(BigNumber.from(19_2500), 1)
      }).timeout(100_000)
    })
  })
})
