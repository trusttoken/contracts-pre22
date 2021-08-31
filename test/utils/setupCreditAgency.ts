import { deployMockContract } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import {
  BorrowingMutex__factory,
  TestTrueFiPool,
  TrueFiPool2,
  TrueCreditAgency__factory,
  TrueFiCreditOracle__factory,
  TrueRateAdjuster__factory,
  BorrowingMutex__factory,
} from 'contracts'
import { TimeAveragedBaseRateOracleJson } from 'build'

export const setupCreditAgency = async (owner: Wallet, pool: TrueFiPool2 | TestTrueFiPool) => {
  const borrowingMutex = await new BorrowingMutex__factory(owner).deploy()
  const creditAgency = await new TrueCreditAgency__factory(owner).deploy()
  const rateAdjuster = await new TrueRateAdjuster__factory(owner).deploy()
  const creditOracle = await new TrueFiCreditOracle__factory(owner).deploy()
  const borrowingMutex = await new BorrowingMutex__factory(owner).deploy()
  const mockBaseRateOracle = await deployMockContract(owner, TimeAveragedBaseRateOracleJson.abi)
  await mockBaseRateOracle.mock.getWeeklyAPY.returns(300)

  await creditAgency.initialize(creditOracle.address, rateAdjuster.address, borrowingMutex.address)
  await rateAdjuster.initialize()
  await creditOracle.initialize()

  await creditAgency.allowPool(pool.address, true)
  await rateAdjuster.setBaseRateOracle(pool.address, mockBaseRateOracle.address)
  await creditOracle.setMaxBorrowerLimit(owner.address, 100_000_000)
  await creditOracle.setScore(owner.address, 255)

  return creditAgency
}
