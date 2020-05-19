import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { MockProvider, solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from '../utils'
import { deploy } from '../../scripts/deploy_testnet'
import { upgrade } from '../../scripts/upgrade'
import { TrueUsdFactory } from '../../build/types/TrueUsdFactory'
import { TokenControllerFactory } from '../../build/types/TokenControllerFactory'
import { AssuredFinancialOpportunityFactory } from '../../build/types/AssuredFinancialOpportunityFactory'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { ProvisionalRegistryImplementationFactory } from '../../build/types/ProvisionalRegistryImplementationFactory'

use(solidity)

describe('Upgrading', () => {
  let deployer: Wallet
  let holder: Wallet
  let provider: MockProvider
  const deployHelperAddress = '0xBCa5c1cBc034C0AF31D976a4e3a36951A537eD77'
  const trueUsdProxyAddress = '0xFDFEF9D10d929cB3905C71400ce6be1990EA0F34'
  const registryProxyAddress = '0xD756fb6A081CC11e7F513C39399DB296b1DE3036'
  const tokenControllerProxyAddress = '0x31ad3E8A7EE9F61C50f074ddE145E6ADC6bB3180'
  const assuredOpportunityProxyAddress = '0xA937Cb4132a165Fff5dCe2435897a19E63e1aD1D'
  const aaveOpportunityProxyAddress = '0x3754b4a1aC4a17Ee8bEa23c5964071F95AcB9Dc1'
  const liquidatorProxyAddress = '0x33d1D66019695D05B0a92694A5d86Df91cb73e80'

  beforeEachWithFixture(async (_provider, wallets) => {
    ([deployer, holder] = wallets)
    provider = _provider
    await deploy(deployer.privateKey, provider, 'prod')
  })

  it('contracts storage is not corrupted by upgrade', async () => {
    const tokenController = new TokenControllerFactory(deployer).attach(tokenControllerProxyAddress)
    const trueUsd = new TrueUsdFactory(deployer).attach(trueUsdProxyAddress)
    const assuredFinancialOpportunity = new AssuredFinancialOpportunityFactory(deployer).attach(assuredOpportunityProxyAddress)
    const registry = new ProvisionalRegistryImplementationFactory(deployer).attach(registryProxyAddress)
    await registry.setAttributeValue(holder.address, '0x6973547275655265776172647357686974656c69737465640000000000000000', 1)

    await tokenController.setMintThresholds(parseEther('1'), parseEther('2'), parseEther('3'))
    await tokenController.setMintLimits(parseEther('1'), parseEther('2'), parseEther('3'))
    await tokenController.refillMultiSigMintPool()
    await tokenController.refillRatifiedMintPool()
    await tokenController.refillInstantMintPool()
    await tokenController.instantMint(holder.address, parseEther('1'))
    await trueUsd.connect(holder).enableTrueReward()

    expect(await trueUsd.opportunity()).to.equal(assuredOpportunityProxyAddress)
    expect(await trueUsd.balanceOf(holder.address)).to.equal(parseEther('1'))
    expect(await trueUsd.trueRewardEnabled(holder.address)).to.be.true
    expect(await trueUsd.totalSupply()).to.equal(parseEther('2'))
    expect(await tokenController.ratifiedMintThreshold()).to.equal(parseEther('2'))
    expect(await assuredFinancialOpportunity.totalSupply()).to.equal(parseEther('1'))

    await upgrade(deployHelperAddress, deployer.privateKey, provider, true)

    expect(await trueUsd.opportunity()).to.equal(assuredOpportunityProxyAddress)
    expect(await trueUsd.rewardTokenBalance(holder.address, assuredOpportunityProxyAddress)).to.equal(parseEther('1'))
    expect(await trueUsd.balanceOf(holder.address)).to.equal(parseEther('1'))
    expect(await trueUsd.balanceOf(holder.address)).to.equal(parseEther('1'))
    expect(await trueUsd.trueRewardEnabled(holder.address)).to.be.true
    expect(await trueUsd.totalSupply()).to.equal(parseEther('2'))
    expect(await tokenController.ratifiedMintThreshold()).to.equal(parseEther('2'))
    expect(await assuredFinancialOpportunity.totalSupply()).to.equal(parseEther('1'))

    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(trueUsdProxyAddress).implementation()).to.equal('0xA49040CAA226AB60d3cD74Adff3Db02Bf85C3D7C')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(tokenControllerProxyAddress).implementation()).to.equal('0x586f99D80602fD78451b7B8d2115469Ae6E6E373')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(aaveOpportunityProxyAddress).implementation()).to.equal('0xfeC0a8D8eeD01ff5E4276f0279bf658d3c545616')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(assuredOpportunityProxyAddress).implementation()).to.equal('0xF6ea1a59eE4c3f874C3f11c8986A205A352e693E')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(liquidatorProxyAddress).implementation()).to.equal('0xf3ebdB487C135Cd699252b27C6dcEC7a2C98A7a6')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(registryProxyAddress).implementation()).to.equal('0x1bF516991437C6133db483d4Bac72dB0ea9f9AA3')
  })
})
