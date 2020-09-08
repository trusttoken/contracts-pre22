import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { MockErc20TokenFactory } from '../../build/types/MockErc20TokenFactory'
import { TrueDistributorFactory } from '../../build/types/TrueDistributorFactory'
import { parseEther } from 'ethers/utils'
import chai, { expect } from 'chai'
import { ContractTransaction, Wallet } from 'ethers'
import { TrueDistributor } from '../../build/types/TrueDistributor'
import { MockErc20Token } from '../../build/types/MockErc20Token'
import { MockProvider, solidity } from 'ethereum-waffle'
import { TrueFarmFactory } from '../../build/types/TrueFarmFactory'
import { TrueFarm } from '../../build/types/TrueFarm'
import { skipBlocksWithProvider } from '../utils/timeTravel'
import { MaxUint256 } from 'ethers/constants'
import { MockDistributorFactory } from '../../build/types/MockDistributorFactory'

chai.use(solidity)

describe('TrueFarm', () => {
  let owner: Wallet
  let staker: Wallet
  let distributor: TrueDistributor
  let trustToken: MockErc20Token
  let stakingToken: MockErc20Token
  let provider: MockProvider
  let farm: TrueFarm

  async function getBlock (tx: Promise<ContractTransaction>) {
    const receipt = await (await tx).wait()
    return receipt.blockNumber
  }

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, staker] = wallets
    provider = _provider
    trustToken = await new MockErc20TokenFactory(owner).deploy()
    stakingToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new MockDistributorFactory(owner).deploy(0, trustToken.address)
    farm = await new TrueFarmFactory(owner).deploy(stakingToken.address, distributor.address)

    await trustToken.mint(distributor.address, parseEther('5365000000000000000'))
    await distributor.transfer(owner.address, farm.address, await distributor.TOTAL_SHARES())
    await stakingToken.mint(staker.address, parseEther('1000'))
    await stakingToken.connect(staker).approve(farm.address, MaxUint256)
  })

  it('yields rewards per staked tokens', async () => {
    const stakeBlock = await getBlock(farm.connect(staker).stake(parseEther('1000')))
    await skipBlocksWithProvider(provider, 5)
    const claimBlock = await getBlock(farm.connect(staker).claim())

    expect(await trustToken.balanceOf(staker.address)).to.equal(claimBlock - stakeBlock)
  })

  it('rewards when stake increases', async () => {
    await farm.connect(staker).stake(parseEther('500'))
    await skipBlocksWithProvider(provider, 5)
    await farm.connect(staker).stake(parseEther('500'))
    await farm.connect(staker).claim()

    expect(await trustToken.balanceOf(staker.address)).to.be.gt(0)
  })
})
