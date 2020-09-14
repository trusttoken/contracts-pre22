import { use, expect } from 'chai'
import {
  RegistryMock,
  CompliantTokenMock,
  ConfigurableFinancialOpportunityMock,
} from '../build'
import { deployContract, loadFixture, solidity } from 'ethereum-waffle'
import { parseEther } from '@ethersproject/units'

use(solidity)

describe('ConfigurableFinancialOpportunityMock', () => {
  const fixture = async ([owner, address1]) => {
    const registry = await deployContract(owner, RegistryMock)
    const token = await deployContract(owner, CompliantTokenMock, [owner.address, parseEther('200')])
    await token.setRegistry(registry.address)

    const financialOpportunity = await deployContract(owner, ConfigurableFinancialOpportunityMock, [token.address])
    await token.transfer(financialOpportunity.address, parseEther('100'))

    return { owner, address1, registry, token, financialOpportunity }
  }

  describe('deposit', async function () {
    it('with exchange rate = 1', async () => {
      const { token, financialOpportunity, owner } = await loadFixture(fixture)
      await token.approve(financialOpportunity.address, parseEther('10'))
      await financialOpportunity.deposit(owner.address, parseEther('10'))

      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('90'))
    })

    it('with exchange rate = 1.5', async () => {
      const { token, financialOpportunity, owner } = await loadFixture(fixture)

      await financialOpportunity.increaseTokenValue(parseEther('0.5'))

      await token.approve(financialOpportunity.address, parseEther('15'))
      await financialOpportunity.deposit(owner.address, parseEther('15'))

      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('10'))
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('85'))
    })
  })

  describe('redeem', async function () {
    const fixtureAfterDeposit = async (accounts) => {
      const result = await fixture(accounts)
      await result.token.approve(result.financialOpportunity.address, parseEther('10'))
      await result.financialOpportunity.deposit(result.owner.address, parseEther('10'))

      return result
    }

    it('redeem', async function () {
      const { address1, owner, financialOpportunity, token } = await loadFixture(fixtureAfterDeposit)

      await financialOpportunity.redeem(address1.address, parseEther('5'))

      expect(await financialOpportunity.totalSupply()).to.equal(parseEther('5'))
      expect(await token.balanceOf(address1.address)).to.equal(parseEther('5'))
      expect(await token.balanceOf(owner.address)).to.equal(parseEther('90'))
    })

    describe('with exchange rate = 1.5', async function () {
      it('can withdraw 50%', async function () {
        const { address1, financialOpportunity, token } = await loadFixture(fixtureAfterDeposit)
        await financialOpportunity.increaseTokenValue(parseEther('0.5'))
        await financialOpportunity.redeem(address1.address, parseEther('5'))

        expect(await financialOpportunity.totalSupply()).to.equal(parseEther('5'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('7.5'))
      })

      it('can withdraw 100%', async function () {
        const { address1, financialOpportunity, token } = await loadFixture(fixtureAfterDeposit)
        await financialOpportunity.increaseTokenValue(parseEther('0.5'))
        await financialOpportunity.redeem(address1.address, parseEther('10'))

        expect(await financialOpportunity.totalSupply()).to.equal(parseEther('0'))
        expect(await token.balanceOf(address1.address)).to.equal(parseEther('15'))
      })
    })
  })
})
