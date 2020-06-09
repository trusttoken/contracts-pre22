import { Contract, Wallet } from 'ethers'
import { deployContract, solidity } from 'ethereum-waffle'
import { parseEther } from 'ethers/utils'
import { expect, use } from 'chai'
import {
  ATokenMock,
  CompliantTokenMock,
  LendingPoolCoreMock,
  LendingPoolMock,
  OwnedUpgradeabilityProxy,
  RegistryMock,
} from '../build'
import { AaveFinancialOpportunityFactory } from '../build/types/AaveFinancialOpportunityFactory'
import { beforeEachWithFixture } from './utils'

use(solidity)

describe('AaveFinancialOpportunity', () => {
  let proxyOwner: Wallet, holder: Wallet, owner: Wallet, address1: Wallet, address2: Wallet, address3: Wallet,
    address4: Wallet
  let financialOpportunity: Contract
  let lendingPool: Contract
  let aToken: Contract
  let lendingPoolCore: Contract
  let token: Contract
  let registry: Contract

  beforeEachWithFixture(async (_, wallets) => {
    ([proxyOwner, holder, owner, address1, address2, address3, address4] = wallets)
    registry = await deployContract(proxyOwner, RegistryMock)
    token = await deployContract(proxyOwner, CompliantTokenMock, [holder.address, parseEther('200')])
    await token.setRegistry(registry.address)

    lendingPoolCore = await deployContract(proxyOwner, LendingPoolCoreMock)
    aToken = await deployContract(proxyOwner, ATokenMock, [token.address, lendingPoolCore.address])
    lendingPool = await deployContract(proxyOwner, LendingPoolMock, [lendingPoolCore.address, aToken.address])
    await token.connect(holder).transfer(aToken.address, parseEther('100'))

    const financialOpportunityImpl = await new AaveFinancialOpportunityFactory(proxyOwner).deploy()
    const financialOpportunityProxy = await deployContract(proxyOwner, OwnedUpgradeabilityProxy)
    financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
    await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)
    await financialOpportunity.configure(aToken.address, lendingPool.address, token.address, owner.address)
  })

  describe('configure', function () {
    it('configured to proper addresses', async () => {
      const aTokenAddress = await financialOpportunity.aToken()
      const lendingPoolAddress = await financialOpportunity.lendingPool()
      const tokenAddress = await financialOpportunity.token()
      const ownerAddress = await financialOpportunity.owner()

      expect(aTokenAddress).to.equal(aToken.address)
      expect(lendingPoolAddress).to.equal(lendingPool.address)
      expect(tokenAddress).to.equal(token.address)
      expect(ownerAddress).to.equal(owner.address)
    })

    it('can reconfigure', async () => {
      await financialOpportunity.configure(address1.address, address2.address, address3.address, address4.address)

      const aTokenAddress = await financialOpportunity.aToken()
      const lendingPoolAddress = await financialOpportunity.lendingPool()
      const tokenAddress = await financialOpportunity.token()
      const ownerAddress = await financialOpportunity.owner()

      expect(aTokenAddress).to.equal(address1.address)
      expect(lendingPoolAddress).to.equal(address2.address)
      expect(tokenAddress).to.equal(address3.address)
      expect(ownerAddress).to.equal(address4.address)
    })

    it('owner cannot reconfigure', async () => {
      await expect(financialOpportunity.connect(owner).configure(address1.address, address2.address, address3.address, address4.address))
        .to.be.revertedWith('only proxy owner')
    })

    it('non-proxyOwner cannot reconfigure', async function () {
      await expect(financialOpportunity.connect(holder).configure(address1.address, address2.address, address3.address, address4.address))
        .to.be.revertedWith('only proxy owner')
    })
  })

  describe('deposit', async function () {
    it('with exchange rate = 1', async function () {
      await token.connect(holder).approve(financialOpportunity.address, parseEther('10'))
      await financialOpportunity.connect(owner).deposit(holder.address, parseEther('10'))

      expect(await financialOpportunity.aTokenBalance()).to.equal(parseEther('10'))
      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('90'))
    })

    it('with exchange rate = 1.5', async () => {
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

      await token.connect(holder).approve(financialOpportunity.address, parseEther('15'))
      await financialOpportunity.connect(owner).deposit(holder.address, parseEther('15'))

      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await financialOpportunity.aTokenBalance()).to.equal(parseEther('15'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('85'))
    })

    it('only owner can call', async function () {
      await expect(financialOpportunity.connect(proxyOwner).deposit(holder.address, parseEther('10'))).to.be.reverted
      await expect(financialOpportunity.connect(holder).deposit(holder.address, parseEther('10'))).to.be.reverted
    })
  })

  describe('redeem', async () => {
    beforeEach(async () => {
      await token.connect(holder).approve(financialOpportunity.address, parseEther('10'))
      await financialOpportunity.connect(owner).deposit(holder.address, parseEther('10'))
    })

    it('redeem', async () => {
      await financialOpportunity.connect(owner).redeem(address1.address, parseEther('5'))

      expect(await financialOpportunity.aTokenBalance()).to.equal(parseEther('5'))
      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('5'))
      expect(await token.balanceOf(address1.address)).to.equal(parseEther('5'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('90'))
    })

    it('only owner can call withdrawTo', async () => {
      await expect(financialOpportunity.connect(proxyOwner).redeem(address1.address, parseEther('5'))).to.be.reverted
      await expect(financialOpportunity.connect(holder).redeem(address1.address, parseEther('5'))).to.be.reverted
    })

    describe('with exchange rate = 1.5', async function () {
      beforeEach(async () => {
        await lendingPoolCore.connect(owner).setReserveNormalizedIncome(parseEther('1500000000'))
      })

      it('can withdraw 50%', async () => {
        await financialOpportunity.connect(owner).redeem(address1.address, parseEther('5'))

        expect(await financialOpportunity.totalSupply()).to.equal(parseEther('5'))
        expect(await financialOpportunity.aTokenBalance()).to.equal(parseEther('7.5'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('7.5'))
      })

      it('can withdraw 100%', async () => {
        await financialOpportunity.connect(owner).redeem(address1.address, parseEther('10'))

        expect(await financialOpportunity.aTokenBalance()).to.equal(parseEther('0'))
        expect(await financialOpportunity.totalSupply()).to.equal(parseEther('0'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('15'))
      })
    })
  })

  it('tokenValue is always equal to exchange rate', async () => {
    expect(await financialOpportunity.tokenValue()).to.equal(parseEther('1'))

    await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

    expect(await financialOpportunity.tokenValue()).to.equal(parseEther('1.5'))
  })
})
