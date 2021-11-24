import { expect, use } from 'chai'
import { deployMockContract, MockContract, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { MockErc20Token, SpotBaseRateOracle, MockErc20Token__factory, SpotBaseRateOracle__factory } from 'contracts'
import { IAaveLendingPoolJson } from 'build'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('SpotBaseRateOracle', () => {
  let owner: Wallet
  let asset: MockErc20Token
  let oracle: SpotBaseRateOracle
  let aaveLendingPool: MockContract

  const aaveLiquidityRate = BigNumber.from(10).pow(23).mul(300)

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets
    const deployContract = setupDeploy(owner)

    asset = await deployContract(MockErc20Token__factory)
    aaveLendingPool = await deployMockContract(owner, IAaveLendingPoolJson.abi)
    oracle = await deployContract(SpotBaseRateOracle__factory, aaveLendingPool.address)

    await aaveLendingPool.mock.getReserveData.returns(0, 0, 0, 0, aaveLiquidityRate, 0, 0, AddressZero, AddressZero, AddressZero, AddressZero, 0)
  })

  describe('constructor', () => {
    it('sets aaveLendingPool', async () => {
      expect(await oracle.aaveLendingPool()).to.eq(aaveLendingPool.address)
    })
  })

  describe('getWeightedBaseRate', () => {
    it('gets correct base rate from one protocol', async () => {
      expect(await oracle.getRate(asset.address)).to.eq(300)
    })
  })
})
