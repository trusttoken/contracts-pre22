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
} from '../build'

use(solidity)

describe('DeployHelper', () => {
  let deployer: Wallet

  const mockOutputUniswapAddress = Wallet.createRandom().address
  const mockStakeUniswapAddress = Wallet.createRandom().address
  const mockAssurancePoolAddress = Wallet.createRandom().address
  const mockATokenAddress = Wallet.createRandom().address
  const mockLendingPoolAddress = Wallet.createRandom().address

  let mockTrustToken: Contract

  let registry: Contract
  let liquidator: Contract
  let fractionalExponents: Contract

  let trueUSD: Contract
  let trueUSDImplementation: Contract
  let trueUSDProxy: Contract

  let tokenController: Contract
  let tokenControllerImplementation: Contract
  let tokenControllerProxy: Contract

  let aaveFinancialOpportunity: Contract
  let aaveFinancialOpportunityImplementation: Contract
  let aaveFinancialOpportunityProxy: Contract

  let assuredFinancialOpportunity: Contract
  let assuredFinancialOpportunityImplementation: Contract
  let assuredFinancialOpportunityProxy: Contract

  let deployHelper: Contract

  beforeEachWithFixture(async (provider, wallets) => {
    ([deployer] = wallets)

    aaveFinancialOpportunityProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    assuredFinancialOpportunityProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    tokenControllerProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)
    trueUSDProxy = await deployContract(deployer, OwnedUpgradeabilityProxy)

    aaveFinancialOpportunityImplementation = await deployContract(deployer, AaveFinancialOpportunity)
    assuredFinancialOpportunityImplementation = await deployContract(deployer, AssuredFinancialOpportunity)
    tokenControllerImplementation = await deployContract(deployer, TokenController)
    trueUSDImplementation = await deployContract(deployer, TrueUSD, [], { gasLimit: 5000000 })

    trueUSD = trueUSDImplementation.attach(trueUSDProxy.address)
    tokenController = tokenControllerImplementation.attach(tokenControllerProxy.address)
    aaveFinancialOpportunity = aaveFinancialOpportunityImplementation.attach(aaveFinancialOpportunityProxy.address)
    assuredFinancialOpportunity = assuredFinancialOpportunityImplementation.attach(assuredFinancialOpportunityProxy.address)

    fractionalExponents = await deployContract(deployer, FractionalExponents)
    registry = await deployContract(deployer, ProvisionalRegistryImplementation)
    mockTrustToken = await deployContract(deployer, MockTrustToken, [registry.address])
    liquidator = await deployContract(deployer, Liquidator, [
      registry.address,
      trueUSD.address,
      mockTrustToken.address,
      mockOutputUniswapAddress,
      mockStakeUniswapAddress,
    ])

    deployHelper = await deployContract(deployer, DeployHelper)

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
      expect(await trueUSD.finOpAddress_()).to.equal(assuredFinancialOpportunity.address)
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

    it('should have opportunity properly set', async () => {
      expect(await assuredFinancialOpportunity.opportunity()).to.equal(aaveFinancialOpportunity.address)
    })

    it('should have assurance properly set', async () => {
      expect(await assuredFinancialOpportunity.assurance()).to.equal(mockAssurancePoolAddress)
    })

    it('should have liquidator properly set', async () => {
      expect(await assuredFinancialOpportunity.liquidator()).to.equal(liquidator.address)
    })

    it('should have exponents properly set', async () => {
      expect(await assuredFinancialOpportunity.exponents()).to.equal(fractionalExponents.address)
    })

    it('should have token properly set', async () => {
      expect(await assuredFinancialOpportunity.token()).to.equal(trueUSD.address)
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
