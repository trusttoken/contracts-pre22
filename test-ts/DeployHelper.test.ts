import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from './utils'
import bytes32 from '../test/helpers/bytes32'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { AssuredFinancialOpportunityFactory } from '../build/types/AssuredFinancialOpportunityFactory'
import { DeployHelperFactory } from '../build/types/DeployHelperFactory'
import { UpgradeHelperFactory } from '../build/types/UpgradeHelperFactory'
import { FractionalExponentsFactory } from '../build/types/FractionalExponentsFactory'
import { LiquidatorFactory } from '../build/types/LiquidatorFactory'
import { OwnedUpgradeabilityProxyFactory } from '../build/types/OwnedUpgradeabilityProxyFactory'
import { ProvisionalRegistryImplementationFactory } from '../build/types/ProvisionalRegistryImplementationFactory'
import { TokenControllerFactory } from '../build/types/TokenControllerFactory'
import { MockTrustTokenFactory } from '../build/types/MockTrustTokenFactory'
import { TrueUsdFactory } from '../build/types/TrueUsdFactory'
import { UpgradeHelper } from '../build/types/UpgradeHelper'
import { DeployHelper } from '../build/types/DeployHelper'
import { OwnedUpgradeabilityProxy } from '../build/types/OwnedUpgradeabilityProxy'
import { AssuredFinancialOpportunity } from '../build/types/AssuredFinancialOpportunity'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { TokenController } from '../build/types/TokenController'
import { TrueUsd } from '../build/types/TrueUsd'
import { FractionalExponents } from '../build/types/FractionalExponents'
import { Liquidator } from '../build/types/Liquidator'
import { Registry } from '../build/types/Registry'
import { MockTrustToken } from '../build/types/MockTrustToken'

use(solidity)

describe('DeployHelper', () => {
  let deployer: Wallet

  const mockOutputUniswapAddress = Wallet.createRandom().address
  const mockStakeUniswapAddress = Wallet.createRandom().address
  const mockAssurancePoolAddress = Wallet.createRandom().address
  const mockATokenAddress = Wallet.createRandom().address
  const mockLendingPoolAddress = Wallet.createRandom().address

  let mockTrustToken: MockTrustToken

  let registry: Registry
  let liquidator: Liquidator
  let fractionalExponents: FractionalExponents

  let trueUSD: TrueUsd
  let trueUSDImplementation: TrueUsd
  let trueUSDProxy: OwnedUpgradeabilityProxy

  let tokenController: TokenController
  let tokenControllerImplementation: TokenController
  let tokenControllerProxy: OwnedUpgradeabilityProxy

  let aaveFinancialOpportunity: AaveFinancialOpportunity
  let aaveFinancialOpportunityImplementation: AaveFinancialOpportunity
  let aaveFinancialOpportunityProxy: OwnedUpgradeabilityProxy

  let assuredFinancialOpportunity: AssuredFinancialOpportunity
  let assuredFinancialOpportunityImplementation: AssuredFinancialOpportunity
  let assuredFinancialOpportunityProxy: OwnedUpgradeabilityProxy

  let deployHelper: DeployHelper
  let upgradeHelper: UpgradeHelper

  beforeEachWithFixture(async (provider, wallets) => {
    ([deployer] = wallets)

    aaveFinancialOpportunityProxy = await new OwnedUpgradeabilityProxyFactory(deployer).deploy()
    assuredFinancialOpportunityProxy = await new OwnedUpgradeabilityProxyFactory(deployer).deploy()
    tokenControllerProxy = await new OwnedUpgradeabilityProxyFactory(deployer).deploy()
    trueUSDProxy = await new OwnedUpgradeabilityProxyFactory(deployer).deploy()

    aaveFinancialOpportunityImplementation = await new AaveFinancialOpportunityFactory(deployer).deploy()
    assuredFinancialOpportunityImplementation = await new AssuredFinancialOpportunityFactory(deployer).deploy()
    tokenControllerImplementation = await new TokenControllerFactory(deployer).deploy()
    trueUSDImplementation = await new TrueUsdFactory(deployer).deploy({ gasLimit: 5000000 })

    trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)
    tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
    aaveFinancialOpportunity = aaveFinancialOpportunityImplementation.attach(aaveFinancialOpportunityProxy.address)
    assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)

    fractionalExponents = await new FractionalExponentsFactory(deployer).deploy()
    registry = await new ProvisionalRegistryImplementationFactory(deployer).deploy()
    mockTrustToken = await new MockTrustTokenFactory(deployer).deploy(registry.address)
    liquidator = await new LiquidatorFactory(deployer).deploy(
      registry.address,
      trueUSD.address,
      mockTrustToken.address,
      mockOutputUniswapAddress,
      mockStakeUniswapAddress,
    )

    deployHelper = await new DeployHelperFactory(deployer).deploy()

    await aaveFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
    await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
    await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
    await trueUSDProxy.transferProxyOwnership(deployHelper.address)

    await liquidator.transferOwnership(deployHelper.address)
    await registry.transferOwnership(deployHelper.address)

    await deployHelper.setup(
      registry.address,
      trueUSDImplementation.address,
      trueUSDProxy.address,
      tokenControllerImplementation.address,
      tokenControllerProxy.address,
      assuredFinancialOpportunityImplementation.address,
      assuredFinancialOpportunityProxy.address,
      aaveFinancialOpportunityImplementation.address,
      aaveFinancialOpportunityProxy.address,
      fractionalExponents.address,
      mockAssurancePoolAddress,
      liquidator.address,
      mockATokenAddress,
      mockLendingPoolAddress,
    )
    await aaveFinancialOpportunityProxy.claimProxyOwnership()
    await assuredFinancialOpportunityProxy.claimProxyOwnership()
    await tokenControllerProxy.claimProxyOwnership()
    await trueUSDProxy.claimProxyOwnership()

    await assuredFinancialOpportunity.claimOwnership()
    await tokenController.claimOwnership()
    await liquidator.claimOwnership()
    await registry.claimOwnership()
  })

  describe('True USD', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await trueUSDProxy.proxyOwner()).to.equal(deployer.address)
    })

    it('implementation should be owned by TokenController', async () => {
      expect(await trueUSD.owner()).to.equal(tokenController.address)
    })

    it('should not be possible to initialize again', async () => {
      await expect(trueUSD.initialize()).to.be.reverted
    })

    it('should have finOpAddress properly set', async () => {
      expect(await trueUSD.opportunity_()).to.equal(assuredFinancialOpportunity.address)
    })

    it('should have registry properly set', async () => {
      expect(await trueUSD.registry()).to.equal(registry.address)
    })
  })

  describe('Registry', () => {
    it('should be owned by deployer', async () => {
      expect(await registry.owner()).to.equal(deployer.address)
    })

    it('should not be possible to initialize again', async () => {
      await expect(registry.initialize()).to.be.reverted
    })

    describe('should be able to finish the configuration', () => {
      const approver = Wallet.createRandom().address
      const pauser = Wallet.createRandom().address

      it('subscribe', async () => {
        await registry.subscribe(bytes32('canBurn'), trueUSD.address)
      })

      it('setAttribute (isTUSDMintApprover)', async () => {
        await registry.setAttribute(approver, bytes32('isTUSDMintApprover'), 1, bytes32('notes'))
      })

      it('setAttribute (isTUSDMintPausers)', async () => {
        await registry.setAttribute(pauser, bytes32('isTUSDMintPausers'), 1, bytes32('notes'))
      })
    })
  })

  describe('Liquidator', () => {
    it('should be owned by deployer', async () => {
      expect(await liquidator.owner()).to.equal(deployer.address)
    })

    it('should not be possible to configured again', async () => {
      await expect(liquidator.configure()).to.be.reverted
    })
  })

  describe('AaveFinancialOpportunity', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await aaveFinancialOpportunityProxy.proxyOwner()).to.equal(deployer.address)
    })

    it('implementation should be owned by AssuredFinancialOpportunity', async () => {
      expect(await aaveFinancialOpportunity.owner()).to.equal(assuredFinancialOpportunity.address)
    })

    it('should have stakeToken properly set', async () => {
      expect(await aaveFinancialOpportunity.stakeToken()).to.equal(mockATokenAddress)
    })

    it('should have lendingPool properly set', async () => {
      expect(await aaveFinancialOpportunity.lendingPool()).to.equal(mockLendingPoolAddress)
    })

    it('should have token properly set', async () => {
      expect(await aaveFinancialOpportunity.token()).to.equal(trueUSD.address)
    })
  })

  describe('AssuredFinancialOpportunity', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await assuredFinancialOpportunityProxy.proxyOwner()).to.equal(deployer.address)
    })

    it('implementation should be owned by deplyer', async () => {
      expect(await assuredFinancialOpportunity.owner()).to.equal(deployer.address)
    })
  })

  describe('TokenController', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await tokenControllerProxy.proxyOwner()).to.equal(deployer.address)
    })

    it('implementation should be owned by deployer', async () => {
      expect(await tokenController.owner()).to.equal(deployer.address)
    })

    it('should not be possible to initialize again', async () => {
      await expect(tokenController.initialize()).to.be.reverted
    })

    it('should have token properly set', async () => {
      expect(await tokenController.token()).to.equal(trueUSD.address)
    })

    it('should have registry properly set', async () => {
      expect(await tokenController.registry()).to.equal(registry.address)
    })

    describe('should be able to finish the configuration', () => {
      it('setMintThresholds', async () => {
        await tokenController.setMintThresholds(parseEther('10'), parseEther('100'), parseEther('1000'))
      })

      it('setMintLimits', async () => {
        await tokenController.setMintLimits(parseEther('30'), parseEther('300'), parseEther('3000'))
      })

      it('refillMultiSigMintPool', async () => {
        await tokenController.refillMultiSigMintPool()
      })

      it('refillRatifiedMintPool', async () => {
        await tokenController.refillRatifiedMintPool()
      })

      it('refillInstantMintPool', async () => {
        await tokenController.refillInstantMintPool()
      })
    })
  })

  describe('UpgradeHelper', () => {
    beforeEach(async () => {
      upgradeHelper = await new UpgradeHelperFactory(deployer).deploy()

      await upgradeHelper.setup(
        registry.address,
        trueUSDProxy.address,
        tokenControllerProxy.address,
        assuredFinancialOpportunityProxy.address,
        aaveFinancialOpportunityProxy.address,
        fractionalExponents.address,
        mockAssurancePoolAddress,
        liquidator.address,
      )

      await aaveFinancialOpportunityProxy.transferProxyOwnership(upgradeHelper.address)
      await assuredFinancialOpportunityProxy.transferProxyOwnership(upgradeHelper.address)
      await tokenControllerProxy.transferProxyOwnership(upgradeHelper.address)
      await trueUSDProxy.transferProxyOwnership(upgradeHelper.address)
      await registry.transferOwnership(upgradeHelper.address)
      await liquidator.transferOwnership(upgradeHelper.address)
    })

    it('upgrade TrueUSD', async () => {
      const newTrueUSDImplementation = await new TrueUsdFactory(deployer).deploy({ gasLimit: 5000000 })
      await upgradeHelper.upgradeTrueUSD(newTrueUSDImplementation.address)
      await trueUSDProxy.claimProxyOwnership()
      expect(await trueUSDProxy.proxyOwner()).to.eq(deployer.address, 'proxy owner')
      expect(await tokenController.token()).to.eq(trueUSDProxy.address, 'token')
      expect(await tokenController.registry()).to.eq(registry.address, 'registry')
      expect(await tokenControllerProxy.proxyOwner()).to.eq(deployer.address, 'controller proxy owner')
      expect(await tokenController.owner()).to.eq(deployer.address, 'pending controller owner')
    })

    it('upgrade Registry', async () => {
      const newRegistry = await new ProvisionalRegistryImplementationFactory(deployer).deploy()
      await tokenController.transferOwnership(upgradeHelper.address)
      await upgradeHelper.upgradeRegistry(newRegistry.address)
      expect(await registry.owner()).to.eq(deployer.address)
      expect(await newRegistry.pendingOwner()).to.eq(deployer.address)
      expect(await tokenController.registry()).to.eq(newRegistry.address)
      expect(await tokenController.registry()).to.eq(newRegistry.address)
      expect(await trueUSD.registry()).to.eq(newRegistry.address)
    })

    it('upgrade TokenController', async () => {
      const newTokenControllerImplementation = await new TokenControllerFactory(deployer).deploy()
      await expect(upgradeHelper.upgradeController(newTokenControllerImplementation.address))
        .to.emit(tokenControllerProxy, 'Upgraded')
        .withArgs(newTokenControllerImplementation.address)
      expect(await tokenControllerProxy.implementation()).to.eq(newTokenControllerImplementation.address)
    })

    it('upgrade Assurance', async () => {
      const newAssuredFinancialOpportunityImplementation = await new AssuredFinancialOpportunityFactory(deployer).deploy()
      expect(await assuredFinancialOpportunityProxy.implementation()).to.eq(assuredFinancialOpportunityImplementation.address)
      await expect(upgradeHelper.upgradeAssurance(newAssuredFinancialOpportunityImplementation.address))
        .to.emit(assuredFinancialOpportunityProxy, 'Upgraded')
        .withArgs(newAssuredFinancialOpportunityImplementation.address)
      expect(await assuredFinancialOpportunityProxy.implementation()).to.eq(newAssuredFinancialOpportunityImplementation.address)
    })

    it('upgrade FinancialOpportunity', async () => {
      const newFinancialOpportunityImplementation = await new AaveFinancialOpportunityFactory(deployer).deploy()
      await expect(upgradeHelper.upgradeFinancialOpportunity(newFinancialOpportunityImplementation.address))
        .to.emit(aaveFinancialOpportunityProxy, 'Upgraded')
        .withArgs(newFinancialOpportunityImplementation.address)
      expect(await aaveFinancialOpportunityProxy.implementation()).to.eq(newFinancialOpportunityImplementation.address)
    })
  })
})
