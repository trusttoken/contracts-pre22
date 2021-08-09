import { expect, use } from 'chai'
import { deployMockContract, MockContract, solidity } from 'ethereum-waffle'
import { BigNumber, Wallet } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
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
    oracle = await deployContract(SpotBaseRateOracle__factory, asset.address, aaveLendingPool.address, 1)

    await aaveLendingPool.mock.getReserveData.returns(0, 0, 0, 0, aaveLiquidityRate, 0, 0, AddressZero, AddressZero, AddressZero, AddressZero, 0)
  })

  describe('constructor', () => {
    it('sets asset', async () => {
      expect(await oracle.asset()).to.eq(asset.address)
    })

    it('sets aaveLendingPool', async () => {
      expect(await oracle.aaveLendingPool()).to.eq(aaveLendingPool.address)
    })

    it('sets aaveWeight', async () => {
      expect(await oracle.aaveWeight()).to.eq(1)
    })
  })

  describe('getWeightedBaseRate', () => {
    it('gets correct base rate from one protocol', async () => {
      expect(await oracle.getWeightedBaseRate()).to.eq(300)
    })
  })
})
