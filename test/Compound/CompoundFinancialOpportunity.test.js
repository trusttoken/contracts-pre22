import assertBalance from '../helpers/assertBalance'
import assertRevert from '../../registry/test/helpers/assertRevert'

const Registry = artifacts.require('RegistryMock')
const CompliantTokenMock = artifacts.require('CompliantTokenMock')
const MockCErc20 = artifacts.require('MockCErc20')
const CompoundFinancialOpportunity = artifacts.require('CompoundFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const BN = web3.utils.toBN;
const bytes32 = require('../helpers/bytes32.js')

contract('CompoundFinancialOpportunity', function ([_, owner, oneHundred, rewardManager, address1, address2, address3]) {
  const IS_REGISTERED_CONTRACT = bytes32('isRegisteredContract');

  beforeEach(async function () {
    this.registry = await Registry.new({ from: owner })
    this.token = await CompliantTokenMock.new(oneHundred, BN(100*10**18), { from: owner })
    await this.token.setRegistry(this.registry.address, { from: owner })
    
    this.cToken = await MockCErc20.new(this.token.address, { from: owner })

    this.financialOpportunityImpl = await CompoundFinancialOpportunity.new({ from: owner })
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
    this.financialOpportunity = await CompoundFinancialOpportunity.at(this.financialOpportunityProxy.address)
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
    await this.financialOpportunity.configure(this.cToken.address, this.token.address, rewardManager, { from: owner })

    await this.registry.setAttributeValue(this.financialOpportunity.address, IS_REGISTERED_CONTRACT, this.financialOpportunity.address, { from: owner });
  })

  it('configured to proper addresses', async function () {
    const cTokenAddress = await this.financialOpportunity.cToken()
    assert.equal(cTokenAddress, this.cToken.address)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, this.token.address)

    const rewardManagerAddress = await this.financialOpportunity.rewardManager()
    assert.equal(rewardManagerAddress, rewardManager)
  })

  it('can reconfigure', async function () {
    await this.financialOpportunity.configure(address1, address2, address3, { from: owner })

    const cTokenAddress = await this.financialOpportunity.cToken()
    assert.equal(cTokenAddress, address1)

    const tokenAddress = await this.financialOpportunity.token()
    assert.equal(tokenAddress, address2)

    const rewardManagerAddress = await this.financialOpportunity.rewardManager()
    assert.equal(rewardManagerAddress, address3)
  })

  it('non-owner cannot reconfigure', async function () {
    await assertRevert(this.financialOpportunity.configure(address1, address2, address3, { from: oneHundred }))
  })

  it('mints cTokens on transfer', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
    await assertBalance(this.token, oneHundred, BN(90*10**18))
    await assertBalance(this.token, this.cToken.address, BN(10*10**18))
  })

  it('can withdraw', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdraw(BN(5*10**18), { from: oneHundred })

    await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
    await assertBalance(this.token, oneHundred, BN(95*10**18))
    await assertBalance(this.token, this.cToken.address, BN(5*10**18))
  })

  it('can withdraw as reward manager', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    await this.financialOpportunity.withdrawFor(oneHundred, BN(5*10**18), { from: rewardManager })

    await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
    await assertBalance(this.token, oneHundred, BN(95*10**18))
    await assertBalance(this.token, this.cToken.address, BN(5*10**18))
  })

  it('cannot withdraw for different user if not calling from reward manager', async function () {
    await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
    await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))

    await assertRevert(this.financialOpportunity.withdrawFor(oneHundred, BN(5*10**18), { from: address1 }))
  })

  describe('with uneven exchange rate', () => {
    beforeEach(async function () {
      await this.cToken.setExchangeRate(BN(1.5*10**18), { from: owner })
    })

    it('can deposit', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.tokenFallback(oneHundred, BN(15*10**18))
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
      await assertBalance(this.token, oneHundred, BN(85*10**18))
      await assertBalance(this.token, this.cToken.address, BN(15*10**18))
    })

    it('can withdraw', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(15*10**18), { from: oneHundred })
      await this.financialOpportunity.tokenFallback(oneHundred, BN(15*10**18))
  
      await this.financialOpportunity.withdraw(BN(5*10**18), { from: oneHundred })
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(5*10**18))
      await assertBalance(this.token, oneHundred, BN(92.5*10**18))
      await assertBalance(this.token, this.cToken.address, BN(7.5*10**18))
    })
  })

  describe('failed withdrawals', function () {
    beforeEach(async function () {
      await this.cToken.setRedeemEnabled(false, { from: owner })
    })

    it('balances stay unchanged', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
      await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))
  
      await this.financialOpportunity.withdraw(BN(5*10**18), { from: oneHundred })
  
      await assertBalance(this.financialOpportunity, oneHundred, BN(10*10**18))
      await assertBalance(this.token, oneHundred, BN(90*10**18))
      await assertBalance(this.token, this.cToken.address, BN(10*10**18))
    })

    it('sets the failed withdrawal for the user', async function () {
      await this.token.transfer(this.financialOpportunity.address, BN(10*10**18), { from: oneHundred })
      await this.financialOpportunity.tokenFallback(oneHundred, BN(10*10**18))
  
      await this.financialOpportunity.withdraw(BN(5*10**18), { from: oneHundred })

      const failedWithdrawal = await this.financialOpportunity.failedWithdrawals(oneHundred)
      assert(failedWithdrawal.timestamp > 0)
      assert(failedWithdrawal.amount.eq(BN(5*10**18)))
    })
  })
})
