import { Contract, Wallet } from 'ethers'
import { solidity, loadFixture } from 'ethereum-waffle'
import { parseEther } from 'ethers/utils'
import { expect, use } from 'chai'
import { deployAll } from './fixtures/deployAll'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { TrueUsd } from '../build/types/TrueUsd'

use(solidity)

describe('AaveFinancialOpportunity', () => {
  let proxyOwner: Wallet, holder: Wallet, owner: Wallet, address1: Wallet, address2: Wallet, address3: Wallet,
    address4: Wallet
  let aaveFinancialOpportunity: AaveFinancialOpportunity
  let lendingPool: Contract
  let aToken: Contract
  let lendingPoolCore
  let token: TrueUsd

  beforeEach(async () => {
    ({
      wallets: [proxyOwner, holder, owner, address1, address2, address3, address4],
      token,
      lendingPoolCore,
      sharesToken: aToken,
      lendingPool,
      aaveFinancialOpportunity,
    } = await loadFixture(deployAll))
    await aaveFinancialOpportunity.configure(aToken.address, lendingPool.address, token.address, owner.address)
    await token.mint(holder.address, parseEther('200'))
    await token.connect(holder).transfer(aToken.address, parseEther('100'))
  })

  describe('configure', function () {
    it('configured to proper addresses', async () => {
      const aTokenAddress = await aaveFinancialOpportunity.aToken()
      const lendingPoolAddress = await aaveFinancialOpportunity.lendingPool()
      const tokenAddress = await aaveFinancialOpportunity.token()
      const ownerAddress = await aaveFinancialOpportunity.owner()

      expect(aTokenAddress).to.equal(aToken.address)
      expect(lendingPoolAddress).to.equal(lendingPool.address)
      expect(tokenAddress).to.equal(token.address)
      expect(ownerAddress).to.equal(owner.address)
    })

    it('can reconfigure', async () => {
      await aaveFinancialOpportunity.configure(address1.address, address2.address, address3.address, address4.address)

      const aTokenAddress = await aaveFinancialOpportunity.aToken()
      const lendingPoolAddress = await aaveFinancialOpportunity.lendingPool()
      const tokenAddress = await aaveFinancialOpportunity.token()
      const ownerAddress = await aaveFinancialOpportunity.owner()

      expect(aTokenAddress).to.equal(address1.address)
      expect(lendingPoolAddress).to.equal(address2.address)
      expect(tokenAddress).to.equal(address3.address)
      expect(ownerAddress).to.equal(address4.address)
    })

    it('owner cannot reconfigure', async () => {
      await expect(aaveFinancialOpportunity.connect(owner).configure(address1.address, address2.address, address3.address, address4.address))
        .to.be.revertedWith('only proxy owner')
    })

    it('non-proxyOwner cannot reconfigure', async function () {
      await expect(aaveFinancialOpportunity.connect(holder).configure(address1.address, address2.address, address3.address, address4.address))
        .to.be.revertedWith('only proxy owner')
    })
  })

  describe('deposit', async function () {
    it('with exchange rate = 1', async function () {
      await token.connect(holder).approve(aaveFinancialOpportunity.address, parseEther('10'))
      await aaveFinancialOpportunity.connect(owner).deposit(holder.address, parseEther('10'))

      expect(await aaveFinancialOpportunity.aTokenBalance()).to.equal(parseEther('10'))
      expect(await aaveFinancialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('90'))
    })

    it('with exchange rate = 1.5', async () => {
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

      await token.connect(holder).approve(aaveFinancialOpportunity.address, parseEther('15'))
      await aaveFinancialOpportunity.connect(owner).deposit(holder.address, parseEther('15'))

      expect(await aaveFinancialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await aaveFinancialOpportunity.aTokenBalance()).to.equal(parseEther('15'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('85'))
    })

    it('only owner can call', async function () {
      await expect(aaveFinancialOpportunity.connect(proxyOwner).deposit(holder.address, parseEther('10'))).to.be.reverted
      await expect(aaveFinancialOpportunity.connect(holder).deposit(holder.address, parseEther('10'))).to.be.reverted
    })
  })

  describe('redeem', async () => {
    beforeEach(async () => {
      await token.connect(holder).approve(aaveFinancialOpportunity.address, parseEther('10'))
      await aaveFinancialOpportunity.connect(owner).deposit(holder.address, parseEther('10'))
    })

    it('redeem', async () => {
      await aaveFinancialOpportunity.connect(owner).redeem(address1.address, parseEther('5'))

      expect(await aaveFinancialOpportunity.aTokenBalance()).to.equal(parseEther('5'))
      expect(await aaveFinancialOpportunity.totalSupply()).to.equal(parseEther('5'))
      expect(await token.balanceOf(address1.address)).to.equal(parseEther('5'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('90'))
    })

    it('only owner can call withdrawTo', async () => {
      await expect(aaveFinancialOpportunity.connect(proxyOwner).redeem(address1.address, parseEther('5'))).to.be.reverted
      await expect(aaveFinancialOpportunity.connect(holder).redeem(address1.address, parseEther('5'))).to.be.reverted
    })

    describe('with exchange rate = 1.5', async function () {
      beforeEach(async () => {
        await lendingPoolCore.connect(owner).setReserveNormalizedIncome(parseEther('1500000000'))
      })

      it('can withdraw 50%', async () => {
        await aaveFinancialOpportunity.connect(owner).redeem(address1.address, parseEther('5'))

        expect(await aaveFinancialOpportunity.totalSupply()).to.equal(parseEther('5'))
        expect(await aaveFinancialOpportunity.aTokenBalance()).to.equal(parseEther('7.5'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('7.5'))
      })

      it('can withdraw 100%', async () => {
        await aaveFinancialOpportunity.connect(owner).redeem(address1.address, parseEther('10'))

        expect(await aaveFinancialOpportunity.aTokenBalance()).to.equal(parseEther('0'))
        expect(await aaveFinancialOpportunity.totalSupply()).to.equal(parseEther('0'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('15'))
      })
    })
  })

  it('tokenValue is always equal to exchange rate', async () => {
    expect(await aaveFinancialOpportunity.tokenValue()).to.equal(parseEther('1'))

    await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

    expect(await aaveFinancialOpportunity.tokenValue()).to.equal(parseEther('1.5'))
  })
})
