import assertBalance from '../helpers/assertBalance'
import assertRevert from '@trusttoken/registry/test/helpers/assertRevert'

const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const BN = web3.utils.toBN;

const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))
const to27Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**17))

contract('AaveFinancialOpportunity', function ([_, proxyOwner, holder, owner, address1, address2, address3, address4]) {

  beforeEach(async function () {
    this.registry = await Registry.new({ from: proxyOwner })
    this.token = await CompliantTokenMock.new(holder, to18Decimals(200), { from: proxyOwner })
    await this.token.setRegistry(this.registry.address, { from: proxyOwner })

    this.lendingPoolCore = await LendingPoolCoreMock.new({ from: proxyOwner })
    this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: proxyOwner })
    this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: proxyOwner })

    await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })

    this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: proxyOwner })
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: proxyOwner })
    this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: proxyOwner })
    await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, owner, { from: proxyOwner })
  })

  describe('configure', function () {
    it('configured to proper addresses', async function () {
      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      const ownerAddress = await this.financialOpportunity.owner()
      assert.equal(sharesTokenAddress, this.sharesToken.address)
      assert.equal(lendingPoolAddress, this.lendingPool.address)
      assert.equal(tokenAddress, this.token.address)
      assert.equal(ownerAddress, owner)

    })

    it('can reconfigure', async function () {
      await this.financialOpportunity.configure(address1, address2, address3, address4, { from: proxyOwner })

      const sharesTokenAddress = await this.financialOpportunity.sharesToken()
      const lendingPoolAddress = await this.financialOpportunity.lendingPool()
      const tokenAddress = await this.financialOpportunity.token()
      const ownerAddress = await this.financialOpportunity.owner()
      assert.equal(sharesTokenAddress, address1)
      assert.equal(lendingPoolAddress, address2)
      assert.equal(tokenAddress, address3)
      assert.equal(ownerAddress, address4)
    })

    it('owner cannot reconfigure', async function () {
      await assertRevert(this.financialOpportunity.configure(address1, address2, address3, address4, { from: owner }))
    })

    it('non-proxyOwner cannot reconfigure', async function () {
      await assertRevert(this.financialOpportunity.configure(address1, address2, address3, address4, { from: holder }))
    })
  })

  describe('deposit', async function() {
    it('with exchange rate = 1', async function () {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10), { from: owner })

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(10)))
      await assertBalance(this.token, holder, to18Decimals(90))
    })

    it('with exchange rate = 1.5', async function () {
      await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: proxyOwner })

      await this.token.approve(this.financialOpportunity.address, to18Decimals(15), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(15), { from: owner })

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(15)))
      await assertBalance(this.token, holder, to18Decimals(85))
    })

    it('only owner can call', async function () {
      assertRevert(this.financialOpportunity.deposit(holder, to18Decimals(10), { from: proxyOwner }))
      assertRevert(this.financialOpportunity.deposit(holder, to18Decimals(10), { from: holder }))
    })
  })

  describe('withdraw', async function() {
    beforeEach(async function() {
      await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: holder })
      await this.financialOpportunity.deposit(holder, to18Decimals(10), { from: owner })
    })

    it('withdrawTo', async function () {
      await this.financialOpportunity.withdrawTo(address1, to18Decimals(5), { from: owner })

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(5)))
      await assertBalance(this.token, address1, to18Decimals(5))
      await assertBalance(this.token, holder, to18Decimals(90))
    })

    it('only owner can call withdrawTo', async function () {
      assertRevert(this.financialOpportunity.withdrawTo(address1, to18Decimals(5), { from: proxyOwner }))
      assertRevert(this.financialOpportunity.withdrawTo(address1, to18Decimals(5), { from: holder }))
    })

    it('withdrawAll', async function () {
      await this.financialOpportunity.withdrawAll(address1, { from: owner })

      await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
      await assertBalance(this.token, address1, to18Decimals(10))
    })

    it('only owner can call withdrawAll', async function () {
      assertRevert(this.financialOpportunity.withdrawAll(address1, { from: proxyOwner }))
      assertRevert(this.financialOpportunity.withdrawAll(address1, { from: holder }))
    })

    describe('with exchange rate = 1.5', async function() {
      beforeEach(async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
      })

      it('can withdraw 50%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(7.5), { from: owner })

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(7.5)))
        await assertBalance(this.token, address1, to18Decimals(7.5))
      })

      it('can withdraw 100%', async function () {
        await this.financialOpportunity.withdrawTo(address1, to18Decimals(15), { from: owner })

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      })

      it('withdrawAll', async function () {
        await this.financialOpportunity.withdrawAll(address1, { from: owner })

        await assert((await this.financialOpportunity.getBalance()).eq(to18Decimals(0)))
        await assertBalance(this.token, address1, to18Decimals(15))
      })
    })
  })

  it('perTokenValue is always equal to exchange rate', async function () {
    const perTokenValue = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue.eq(to18Decimals(1)))

    await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5))

    const perTokenValue2 = await this.financialOpportunity.perTokenValue()
    assert(perTokenValue2.eq(to18Decimals(1.5)))
  })
})
