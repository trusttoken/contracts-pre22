import { Wallet } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import { LendingPoolFactory } from '../../build/types/LendingPoolFactory'
import { LendingPoolCoreFactory } from '../../build/types/LendingPoolCoreFactory'
import CoreLibrary from '../../build/CoreLibrary.json'
import { ATokenFactory } from '../../build/types/ATokenFactory'
import { LendingPoolAddressesProviderFactory } from '../../build/types/LendingPoolAddressesProviderFactory'
import { DefaultReserveInterestRateStrategyFactory } from '../../build/types/DefaultReserveInterestRateStrategyFactory'
import { LendingPoolConfiguratorFactory } from '../../build/types/LendingPoolConfiguratorFactory'
import { LendingRateOracleFactory } from '../../build/types/LendingRateOracleFactory'
import { PriceOracleFactory } from '../../build/types/PriceOracleFactory'
import { LendingPoolDataProviderFactory } from '../../build/types/LendingPoolDataProviderFactory'
import { FeeProviderFactory } from '../../build/types/FeeProviderFactory'
import { parseEther } from 'ethers/utils'

export const deployAave = async (deployer: Wallet, tusd: string) => {
  const lendingPoolImpl = await new LendingPoolFactory(deployer).deploy()
  const lib = await deployContract(deployer, CoreLibrary)
  const lendingPoolCoreImpl = await new LendingPoolCoreFactory({
    'contracts/lib/aave/libraries/CoreLibrary.sol:CoreLibrary': lib.address,
  }, deployer).deploy()
  const lendingPoolConfiguratorImpl = await new LendingPoolConfiguratorFactory(deployer).deploy()
  const lendingPoolDataProviderImpl = await new LendingPoolDataProviderFactory(deployer).deploy()
  const oracleImpl = await new LendingRateOracleFactory(deployer).deploy()
  const priceOracleImpl = await new PriceOracleFactory(deployer).deploy()
  const feeProvider = await new FeeProviderFactory(deployer).deploy()

  const addressesProvider = await new LendingPoolAddressesProviderFactory(deployer).deploy()
  await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
  await addressesProvider.setFeeProviderImpl(feeProvider.address)
  await addressesProvider.setLendingPoolCoreImpl(lendingPoolCoreImpl.address)
  await addressesProvider.setLendingPoolDataProviderImpl(lendingPoolDataProviderImpl.address)
  await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address)
  await addressesProvider.setLendingRateOracle(oracleImpl.address)
  await addressesProvider.setPriceOracle(priceOracleImpl.address)
  await addressesProvider.setLendingPoolManager(deployer.address)

  const oracle = LendingRateOracleFactory.connect(await addressesProvider.getLendingRateOracle(), deployer)
  const priceOracle = PriceOracleFactory.connect(await addressesProvider.getPriceOracle(), deployer)
  const lendingPool = LendingPoolFactory.connect(await addressesProvider.getLendingPool(), deployer)
  const lendingPoolCore = LendingPoolCoreFactory.connect(await addressesProvider.getLendingPoolCore(), deployer)
  const lendingPoolDataProvider = LendingPoolDataProviderFactory.connect(await addressesProvider.getLendingPoolDataProvider(), deployer)
  const lendingPoolConfigurator = LendingPoolConfiguratorFactory.connect(await addressesProvider.getLendingPoolConfigurator(), deployer)
  await lendingPoolConfigurator.refreshLendingPoolCoreConfiguration()

  // Values taken from here https://etherscan.io/address/0x98C2568114Bf5d14cBe880912058fd5850a1C557#readContract
  await oracle.setMarketBorrowRate(tusd, '35000000000000000000000000')
  await priceOracle.setAssetPrice(tusd, '4289170000000000')
  const interestRateStrategy = await new DefaultReserveInterestRateStrategyFactory(deployer).deploy(
    tusd,
    addressesProvider.address,
    '10000000000000000000000000',
    '40000000000000000000000000',
    '500000000000000000000000000',
    '140000000000000000000000000',
    '600000000000000000000000000',
  )
  await lendingPoolConfigurator.initReserve(tusd, 18, interestRateStrategy.address)
  await lendingPoolConfigurator.enableBorrowingOnReserve(tusd, false)
  await lendingPoolConfigurator.enableReserveAsCollateral(tusd, parseEther('50'), parseEther('50'), parseEther('50'))
  const aTokenAddress = await lendingPoolCore.getReserveATokenAddress(tusd)
  const aTUSD = ATokenFactory.connect(aTokenAddress, deployer)
  return {
    lendingPool,
    lendingPoolCore,
    aTUSD,
    lendingPoolDataProvider,
  }
}
