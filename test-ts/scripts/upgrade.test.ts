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
  const deployHelperAddress = '0x490932174cc4B7a0f546924a070D151D156095f0'
  const trueUsdProxyAddress = '0xaC8444e7d45c34110B34Ed269AD86248884E78C7'
  const registryProxyAddress = '0xFf807885934003A35b1284d7445fc83Fd23417e5'
  const tokenControllerProxyAddress = '0x956dA338C1518a7FB213042b70c60c021aeBd554'
  const assuredOpportunityProxyAddress = '0x84e924C5E04438D2c1Df1A981f7E7104952e6de1'
  const aaveOpportunityProxyAddress = '0x0BDb999cFA9c47d6d62323a1905F8Eb7B3c9B119'
  const liquidatorProxyAddress = '0x339467A84eC1Ac112d9068EA276154F640E720C0'

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
    await registry.claimOwnership()
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

    await upgrade(deployHelperAddress, deployer.privateKey, provider)

    expect(await trueUsd.opportunity()).to.equal(assuredOpportunityProxyAddress)
    expect(await trueUsd.balanceOf(holder.address)).to.equal(parseEther('1'))
    expect(await trueUsd.trueRewardEnabled(holder.address)).to.be.true
    expect(await trueUsd.totalSupply()).to.equal(parseEther('2'))
    expect(await tokenController.ratifiedMintThreshold()).to.equal(parseEther('2'))
    expect(await assuredFinancialOpportunity.totalSupply()).to.equal(parseEther('1'))

    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(trueUsdProxyAddress).implementation()).to.equal('0x55ED754c9cE31B6C5D206F7a9836cE97ED4Bf62D')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(tokenControllerProxyAddress).implementation()).to.equal('0x98DfaB377889D3cbeEf8FC7877143F297aBea2Ab')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(aaveOpportunityProxyAddress).implementation()).to.equal('0x9851dBbBD64b327b529336837461Cd5d73d9D5Fd')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(assuredOpportunityProxyAddress).implementation()).to.equal('0x0b2955A848e1da49962D138466cECd47655442f7')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(liquidatorProxyAddress).implementation()).to.equal('0x370F36F2B18DA105F32cC3Cf4C4D5cD7435CAdc7')
    expect(await new OwnedUpgradeabilityProxyFactory(deployer).attach(registryProxyAddress).implementation()).to.equal('0x35E5966c834036DDa71893E078D54d88c4fEB8C9')
  })
})
