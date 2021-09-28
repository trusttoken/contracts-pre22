import { deployMockContract } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import {
  BorrowingMutex__factory,
  LoanFactory2,
  PoolFactory,
  TestTrueFiPool,
  TrueFiPool2,
  LineOfCreditAgency__factory,
  TrueFiCreditOracle__factory,
  CreditModel__factory,
} from 'contracts'
import { TimeAveragedBaseRateOracleJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

export const setupCreditAgency = async (owner: Wallet, poolFactory: PoolFactory, loanFactory: LoanFactory2, pool: TrueFiPool2 | TestTrueFiPool) => {
  const borrowingMutex = await new BorrowingMutex__factory(owner).deploy()
  const creditAgency = await new LineOfCreditAgency__factory(owner).deploy()
  const creditModel = await new CreditModel__factory(owner).deploy()
  const creditOracle = await new TrueFiCreditOracle__factory(owner).deploy()
  const mockBaseRateOracle = await deployMockContract(owner, TimeAveragedBaseRateOracleJson.abi)
  await mockBaseRateOracle.mock.getWeeklyAPY.returns(300)

  await creditAgency.initialize(creditOracle.address, creditModel.address, borrowingMutex.address, poolFactory.address, loanFactory.address)
  await creditModel.initialize(AddressZero)
  await creditOracle.initialize()

  await poolFactory.supportPool(pool.address)
  await creditModel.setBaseRateOracle(pool.address, mockBaseRateOracle.address)
  await creditOracle.setMaxBorrowerLimit(owner.address, 100_000_000)
  await creditOracle.setScore(owner.address, 255)

  return creditAgency
}
