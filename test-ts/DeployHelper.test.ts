import { expect, use } from 'chai'
import { Contract, Wallet } from 'ethers'
import { parseEther } from 'ethers/utils'
import { deployContract, solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from './utils'
import bytes32 from '../test/helpers/bytes32'
import {
  AaveFinancialOpportunity,
  AssuredFinancialOpportunity,
  DeployHelper,
  FractionalExponents,
  Liquidator,
  OwnedUpgradeabilityProxy,
  ProvisionalRegistryImplementation,
  TokenController,
  MockTrustToken,
  TrueUSD,
  StakedToken,
  TimeOwnedUpgradeabilityProxy,
} from '../build'

use(solidity)

describe('DeployHelper', () => {
  let deployer: Wallet

  const mockOutputUniswapAddress = Wallet.createRandom().address
  const mockStakeUniswapAddress = Wallet.createRandom().address
  const mockATokenAddress = Wallet.createRandom().address
  const mockLendingPoolAddress = Wallet.createRandom().address

  let trustTokenProxy: Contract
  let mockTrustTokenImplementation: Contract

  let fractionalExponents: Contract

  let liquidator: Contract
  let liquidatorImplementation: Contract
  let liquidatorProxy: Contract

  let trueUSD: Contract
  let trueUSDImplementation: Contract
  let trueUSDProxy: Contract

  let registry: Contract
  let registryImplementation: Contract
  let registryProxy: Contract

  let tokenController: Contract
  let tokenControllerImplementation: Contract
  let tokenControllerProxy: Contract

  let aaveFinancialOpportunity: Contract
  let aaveFinancialOpportunityImplementation: Contract
  let aaveFinancialOpportunityProxy: Contract

  let assuredFinancialOpportunity: Contract
  let assuredFinancialOpportunityImplementation: Contract
  let assuredFinancialOpportunityProxy: Contract

  let stakedTokenImplementation: Contract
  let stakedTokenProxy: Contract

  let deployHelper: Contract

  beforeEachWithFixture(async (provider, wallets) => {
    ([deployer] = wallets)

    liquidatorProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    aaveFinancialOpportunityProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    assuredFinancialOpportunityProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    tokenControllerProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    trueUSDProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    registryProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    stakedTokenProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    trustTokenProxy = await deployContract(deployer, TimeOwnedUpgradeabilityProxy)

    liquidatorImplementation = await deployContract(deployer, Liquidator)
    aaveFinancialOpportunityImplementation = await deployContract(deployer, AaveFinancialOpportunity)
    assuredFinancialOpportunityImplementation = await deployContract(deployer, AssuredFinancialOpportunity)
    tokenControllerImplementation = await deployContract(deployer, TokenController)
    trueUSDImplementation = await deployContract(deployer, TrueUSD, [], { gasLimit: 5000000 })
    registryImplementation = await deployContract(deployer, ProvisionalRegistryImplementation)
    stakedTokenImplementation = await deployContract(deployer, StakedToken)
    mockTrustTokenImplementation = await deployContract(deployer, MockTrustToken)

    liquidator = liquidatorImplementation.attach(liquidatorProxy.address)
    trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)
    registry = registryImplementation.attach(registryProxy.address)
    tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
    aaveFinancialOpportunity = aaveFinancialOpportunityImplementation.attach(aaveFinancialOpportunityProxy.address)
    assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)

    fractionalExponents = await deployContract(deployer, FractionalExponents)

    deployHelper = await deployContract(deployer, DeployHelper, [
      trueUSDProxy.address,
      registryProxy.address,
      tokenControllerProxy.address,
      trustTokenProxy.address,
      assuredFinancialOpportunityProxy.address,
      aaveFinancialOpportunityProxy.address,
      stakedTokenProxy.address,
      liquidatorProxy.address,
      fractionalExponents.address,
    ])

    await liquidatorProxy.transferProxyOwnership(deployHelper.address)
    await aaveFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
    await assuredFinancialOpportunityProxy.transferProxyOwnership(deployHelper.address)
    await tokenControllerProxy.transferProxyOwnership(deployHelper.address)
    await trueUSDProxy.transferProxyOwnership(deployHelper.address)
    await registryProxy.transferProxyOwnership(deployHelper.address)
    await stakedTokenProxy.transferProxyOwnership(deployHelper.address)
    await trustTokenProxy.transferProxyOwnership(deployHelper.address)

    await deployHelper.setup(
      trueUSDImplementation.address,
      registryImplementation.address,
      tokenControllerImplementation.address,
      mockTrustTokenImplementation.address,
      assuredFinancialOpportunityImplementation.address,
      aaveFinancialOpportunityImplementation.address,
      stakedTokenImplementation.address,
      liquidatorImplementation.address,
      mockATokenAddress,
      mockLendingPoolAddress,
      mockOutputUniswapAddress,
      mockStakeUniswapAddress,
    )

    await aaveFinancialOpportunityProxy.claimProxyOwnership()
    await assuredFinancialOpportunityProxy.claimProxyOwnership()
    await tokenControllerProxy.claimProxyOwnership()
    await trueUSDProxy.claimProxyOwnership()
    await registryProxy.claimProxyOwnership()
    await liquidatorProxy.claimProxyOwnership()
    await stakedTokenProxy.claimProxyOwnership()

    await assuredFinancialOpportunity.claimOwnership()
    await tokenController.claimOwnership()
    await registry.claimOwnership()
  })

  describe('True USD', () => {
    it('trustproxy should be owned by deployer', async () => {
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
    it('proxy should be owned by deployer', async () => {
      expect(await registryProxy.proxyOwner()).to.equal(deployer.address)
    })

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
    it('should be owned by AssuredFinancialOpportunity', async () => {
      expect(await liquidator.owner()).to.equal(assuredFinancialOpportunity.address)
    })

    it('should not be possible to configured again', async () => {
      await expect(liquidator.configure(
        registry.address,
        trueUSD.address,
        mockTrustTokenImplementation.address,
        mockOutputUniswapAddress,
        mockStakeUniswapAddress,
      )).to.be.reverted
    })
  })

  describe('AaveFinancialOpportunity', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await aaveFinancialOpportunityProxy.proxyOwner()).to.equal(deployer.address)
    })

    it('implementation should be owned by AssuredFinancialOpportunity', async () => {
      expect(await aaveFinancialOpportunity.owner()).to.equal(assuredFinancialOpportunity.address)
    })

    it('should have aToken properly set', async () => {
      expect(await aaveFinancialOpportunity.aToken()).to.equal(mockATokenAddress)
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

  describe('StakedToken', () => {
    it('proxy should be owned by deployer', async () => {
      expect(await stakedTokenProxy.proxyOwner()).to.equal(deployer.address)
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
})
