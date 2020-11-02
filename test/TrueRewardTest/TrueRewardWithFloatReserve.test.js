const BN = web3.utils.toBN
const TrueUSDMock = artifacts.require('TrueUSDMock')
const Registry = artifacts.require('RegistryMock')
const ATokenMock = artifacts.require('ATokenMock')
const LendingPoolMock = artifacts.require('LendingPoolMock')
const LendingPoolCoreMock = artifacts.require('LendingPoolCoreMock')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const to18Decimals = value => BN(Math.floor(value * 10 ** 10)).mul(BN(10 ** 8))

contract('TrueRewardWithFloatReserve', function (accounts) {
  const [, owner, holder, holder2, sender, recipient] = accounts
  const WHITELIST_TRUEREWARD = '0x6973547275655265776172647357686974656c69737465640000000000000000'
  describe('TrueReward with float admin', function () {
    beforeEach(async function () {
      this.registry = await Registry.new({ from: owner })
      this.token = await TrueUSDMock.new(holder, to18Decimals(500), { from: owner })
      await this.token.setRegistry(this.registry.address, { from: owner })

      this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
      this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
      this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })

      await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })

      this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
      this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
      this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
      await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
      await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, this.token.address, { from: owner })
      await this.token.setOpportunityAddress(this.financialOpportunity.address, { from: owner })
      this.reserve = await this.token.RESERVE.call()

      await this.registry.setAttributeValue(this.reserve, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(owner, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(holder, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(holder2, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(sender, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(recipient, WHITELIST_TRUEREWARD, 1, { from: owner })
    })

    it('convert TUSD reserve into aave float reserve', async function () {
      await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
      let reserveZTUSDBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(reserveZTUSDBalance, 0)
      await this.token.opportunityReserveMint(to18Decimals(100), { from: owner })
      reserveZTUSDBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(reserveZTUSDBalance.toString(), to18Decimals(100).toString())
      const reserveTUSDBalance = await this.token.balanceOf.call(this.reserve)
      assert.equal(reserveTUSDBalance.toString(), to18Decimals(100).toString())
    })

    it('convert aave float reserve back to TUSD', async function () {
      await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
      await this.token.opportunityReserveMint(to18Decimals(100), { from: owner })
      await this.token.opportunityReserveRedeem(to18Decimals(50), { from: owner })
      const reserveZTUSDBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(reserveZTUSDBalance.toString(), to18Decimals(50).toString())
      const reserveTUSDBalance = await this.token.balanceOf.call(this.reserve)
      assert.equal(reserveTUSDBalance.toString(), to18Decimals(150).toString())
    })
  })
  describe('TrueReward with float transfers', function () {
    beforeEach(async function () {
      this.registry = await Registry.new({ from: owner })
      this.token = await TrueUSDMock.new(holder, to18Decimals(500), { from: owner })
      await this.token.setRegistry(this.registry.address, { from: owner })

      this.lendingPoolCore = await LendingPoolCoreMock.new({ from: owner })
      this.sharesToken = await ATokenMock.new(this.token.address, this.lendingPoolCore.address, { from: owner })
      this.lendingPool = await LendingPoolMock.new(this.lendingPoolCore.address, this.sharesToken.address, { from: owner })

      await this.token.transfer(this.sharesToken.address, to18Decimals(100), { from: holder })
      await this.token.transfer(holder2, to18Decimals(100), { from: holder })

      this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: owner })
      this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: owner })
      this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
      await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: owner })
      await this.financialOpportunity.configure(this.sharesToken.address, this.lendingPool.address, this.token.address, this.token.address, { from: owner })
      await this.token.setOpportunityAddress(this.financialOpportunity.address, { from: owner })
      this.reserve = await this.token.RESERVE.call()

      await this.registry.setAttributeValue(this.reserve, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(owner, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(holder, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(holder2, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(sender, WHITELIST_TRUEREWARD, 1, { from: owner })
      await this.registry.setAttributeValue(recipient, WHITELIST_TRUEREWARD, 1, { from: owner })

      await this.token.transfer(this.reserve, to18Decimals(200), { from: holder })
      await this.token.opportunityReserveMint(to18Decimals(100), { from: owner })
    })
    it('transfer without trueReward', async function () {
      await this.token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.transfer(recipient, to18Decimals(50), { from: sender })
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(recipient)
      const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve)
      const zTUSDReserveBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(senderBalance.toString(), to18Decimals(50).toString())
      assert.equal(receipientBalance.toString(), to18Decimals(50).toString())
      assert.equal(TUSDReserveBalance.toString(), to18Decimals(100).toString())
      assert.equal(zTUSDReserveBalance.toString(), to18Decimals(100).toString())
    })

    it('sender truereward enabled recipient not enabled', async function () {
      await this.token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.enableTrueReward({ from: sender })
      await this.token.transfer(recipient, to18Decimals(50), { from: sender })
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(recipient)
      const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve)
      const zTUSDReserveBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(senderBalance.toString(), to18Decimals(50).toString())
      assert.equal(receipientBalance.toString(), to18Decimals(50).toString())
      assert.equal(TUSDReserveBalance.toString(), to18Decimals(150).toString())
      assert.equal(zTUSDReserveBalance.toString(), to18Decimals(50).toString())
    })

    it('sender truereward not enabled recipient enabled', async function () {
      await this.token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.enableTrueReward({ from: recipient })
      await this.token.transfer(recipient, to18Decimals(50), { from: sender })
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(recipient)
      const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve)
      const zTUSDReserveBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(senderBalance.toString(), to18Decimals(50).toString())
      assert.equal(receipientBalance.toString(), to18Decimals(50).toString())
      assert.equal(TUSDReserveBalance.toString(), to18Decimals(150).toString())
      assert.equal(zTUSDReserveBalance.toString(), to18Decimals(50).toString())
    })

    it('sender truereward enabled recipient enabled', async function () {
      await this.token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.enableTrueReward({ from: sender })
      await this.token.enableTrueReward({ from: recipient })
      await this.token.transfer(recipient, to18Decimals(50), { from: sender })
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(recipient)
      const TUSDReserveBalance = await this.token.balanceOf.call(this.reserve)
      const zTUSDReserveBalance = await this.token.rewardTokenBalance.call(
        this.reserve,
        this.financialOpportunity.address,
      )
      assert.equal(senderBalance.toString(), to18Decimals(50).toString())
      assert.equal(receipientBalance.toString(), to18Decimals(50).toString())
      assert.equal(TUSDReserveBalance.toString(), to18Decimals(200).toString())
      assert.equal(zTUSDReserveBalance.toString(), to18Decimals(0).toString())
    })
  })
})
