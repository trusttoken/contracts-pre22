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
  const deployHelperAddress = '0xbAe83CF0cd8DE043A9A2188833e8cB69aB6c7103'
  const trueUsdProxyAddress = '0xaC8444e7d45c34110B34Ed269AD86248884E78C7'
  const registryProxyAddress = '0xFf807885934003A35b1284d7445fc83Fd23417e5'
  const tokenControllerProxyAddress = '0x956dA338C1518a7FB213042b70c60c021aeBd554'
  const assuredOpportunityProxyAddress = '0x84e924C5E04438D2c1Df1A981f7E7104952e6de1'
  const aaveOpportunityProxyAddress = '0x6f2fa37EBfaf089C4Fd7e6124C1028306943D11d'
  const liquidatorProxyAddress = '0xbF42E6bD8fA05956E28F7DBE274657c262526F3D'

  beforeEachWithFixture(async (_provider, wallets) => {
    ([deployer, holder] = wallets)
    provider = _provider
    await deploy(deployer.privateKey, provider)
  })

  it('contracts storage is not corrupted by upgrade', async () => {
    const tokenController = new TokenControllerFactory(deployer).attach(tokenControllerProxyAddress)
    const trueUsd = new TrueUsdFactory(deployer).attach(trueUsdProxyAddress)
    const assuredFinancialOpportunity = new AssuredFinancialOpportunityFactory(deployer).attach(assuredOpportunityProxyAddress)
    const registry = new ProvisionalRegistryImplementationFactory(deployer).attach(registryProxyAddress)
    console.log('here')
    await registry.setAttributeValue(holder.address, '0x6973547275655265776172647357686974656c69737465640000000000000000', 1)
    console.log('there')

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

    await upgrade(deployHelperAddress, deployer.privateKey, provider)

    expect(await trueUsd.opportunity()).to.equal(assuredOpportunityProxyAddress)
    expect(await trueUsd.balanceOf(holder.address)).to.equal(parseEther('1'))
    expect(await trueUsd.trueRewardEnabled(holder.address)).to.be.true
    expect(await trueUsd.totalSupply()).to.equal(parseEther('2'))
    expect(await tokenController.ratifiedMintThreshold()).to.equal(parseEther('2'))
    expect(await assuredFinancialOpportunity.totalSupply()).to.equal(parseEther('1'))

    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(trueUsdProxyAddress).implementation()).to.equal('0x86Da7600BA11A5D40088AA3871273f0a23d1Ca31')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(tokenControllerProxyAddress).implementation()).to.equal('0x8C73904FB36c8a844143B694C2A10343d0BFF896')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(aaveOpportunityProxyAddress).implementation()).to.equal('0x3d65305F56baB9Cb512142e57936027329bA7624')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(assuredOpportunityProxyAddress).implementation()).to.equal('0x2d245Cc3806fceAE0994142B75665E0343f150aE')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(liquidatorProxyAddress).implementation()).to.equal('0xD095E3Fb03A4B1a9A80C936cAF99e5a60aFaDeaA')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(registryProxyAddress).implementation()).to.equal('0xF81ced20aFE509f19766ca7d9859c6C1a7D01965')
  })
})
