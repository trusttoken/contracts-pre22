import { Contract, ethers, providers } from 'ethers'
import { MockTrustTokenFactory } from '../build/types/MockTrustTokenFactory'
import { BigNumber, formatEther, parseEther } from 'ethers/utils'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { StakedTokenFactory } from '../build/types/StakedTokenFactory'
import { RegistryImplementationFactory } from '../build/types/RegistryImplementationFactory'
import { RegistryImplementation } from '../build/types/RegistryImplementation'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import addresses from './deploy/ropsten.json'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { RegistryAttributes } from './attributes'
import { TokenControllerFactory } from '../build/types/TokenControllerFactory'
import { TokenFaucet } from '../build/types/TokenFaucet'
import { TokenFaucetFactory } from '../build/types/TokenFaucetFactory'

use(solidity)
const REGISTRY_DEPLOYMENT_BLOCK = 7901430

const wait = async <T>(tx: Promise<{wait: () => Promise<T>}>): Promise<T> => (await tx).wait()

describe('ropsten test', function () {
  this.timeout(10000000)
  const provider = new providers.InfuraProvider('ropsten', '81447a33c1cd4eb09efb1e8c388fb28e')
  // expected to have some tUSD
  const staker = new ethers.Wallet('0x285BDA73F1FB694325F227B80EC7E7758C5360ED1BE71EEECFE50BA9D902C856', provider)
  // expected to have no tUSD
  const brokePerson = new ethers.Wallet('01AD2BF11C43641B22DB8CEACF26FBF4B509581CDCD5D747669B6EE8A1E2C6C7', provider)
  const owner = new ethers.Wallet('0x2F4E984196CCE414D059C91230917F10F3067F3F8E7DAF6C0B0933C13F9AF8FA', provider)
  const tusd = TrueUsdFactory.connect(addresses.trueUSD, owner)
  const faucet = TokenFaucetFactory.connect(addresses.tokenController, owner)
  const trustToken = MockTrustTokenFactory.connect(addresses.trustToken, owner)
  const stakeToken = StakedTokenFactory.connect(addresses.stakedToken, owner)
  const registry = RegistryImplementationFactory.connect(addresses.registry, owner)
  const aaveFinOp = AaveFinancialOpportunityFactory.connect(addresses.financialOpportunity, owner)
  const assuredFinOp = AssuredFinancialOpportunityFactory.connect(addresses.assuredFinancialOpportunity, owner)

  const BTC1000 = parseEther('1000').div(1e10)

  it('trueRewards enable-disable with 0 balance', async () => {
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    await wait(registry.setAttributeValue(brokePerson.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1))
    await wait(tusd.connect(brokePerson).enableTrueReward({ gasLimit: 100000 }))
    await wait(tusd.connect(brokePerson).disableTrueReward({ gasLimit: 100000 }))
  })

  it('trueRewards enable-disable with some balance', async () => {
    await wait(faucet.connect(staker).faucet(parseEther('1000'), { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(staker.address)).to.be.gte(parseEther('1000'))
    expect(await tusd.trueRewardEnabled(staker.address)).to.be.false
    await wait(registry.setAttributeValue(staker.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1, { gasLimit: 1000000 }))
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 1000000 }))
  })

  it('disabled -> enabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(faucet.connect(brokePerson).faucet(10))
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(brokePerson).transfer(staker.address, 10, { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.balanceOf(staker.address)).to.be.gte(receiverBalanceBefore.add(10))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('enabled -> enabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    await wait(faucet.connect(brokePerson).faucet(10, { gasLimit: 1000000 }))
    await wait(tusd.connect(brokePerson).enableTrueReward({ gasLimit: 1000000 }))
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 1000000 }))
    // 1 wei error here
    expect(await tusd.balanceOf(brokePerson.address)).to.be.lte(1)
    expect(await tusd.balanceOf(staker.address)).to.be.gte(receiverBalanceBefore.add(9))
    await wait(tusd.connect(brokePerson).disableTrueReward({ gasLimit: 1000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('enabled -> disabled', async () => {
    await wait(tusd.connect(staker).enableTrueReward({ gasLimit: 1000000 }))
    expect(await tusd.trueRewardEnabled(brokePerson.address)).to.be.false
    expect(await tusd.trueRewardEnabled(staker.address)).to.be.true
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 1000000 }))
    const receiverBalanceBefore = await tusd.balanceOf(staker.address)
    await wait(tusd.connect(staker).transfer(brokePerson.address, parseEther('1'), { gasLimit: 1000000 }))
    console.log(formatEther(receiverBalanceBefore))
    console.log(formatEther(await tusd.balanceOf(staker.address)))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(parseEther('1').sub(1))
    expect(await tusd.balanceOf(staker.address)).to.be.lte(receiverBalanceBefore.sub(parseEther('0.99')))
    await wait(tusd.connect(brokePerson).transfer(staker.address, await tusd.balanceOf(brokePerson.address), { gasLimit: 1000000 }))
    await wait(tusd.connect(staker).disableTrueReward({ gasLimit: 5000000 }))
  })

  it('disabled -> disabled', async () => {
    const receiverBalanceBefore = await tusd.balanceOf('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01')
    await wait(faucet.connect(brokePerson).faucet(10, { gasLimit: 1000000 }))
    await wait(tusd.connect(brokePerson).transfer('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01', await tusd.balanceOf(brokePerson.address), { gasLimit: 1000000 }))
    expect(await tusd.balanceOf(brokePerson.address)).to.equal(0)
    expect(await tusd.balanceOf('0xE73B9F4b99CAC17723192D457234A27E7a8fBC01')).to.equal(receiverBalanceBefore.add(10))
  })
})
