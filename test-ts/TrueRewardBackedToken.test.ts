import {expect, use} from 'chai'
import {Contract, Wallet} from 'ethers'
import {deployContract, solidity} from 'ethereum-waffle'
import {beforeEachWithFixture} from './utils'
import {
  AaveFinancialOpportunity,
  AssuredFinancialOpportunity,
  ATokenMock,
  ConfigurableFinancialOpportunityMock,
  FractionalExponents,
  LendingPoolCoreMock,
  LendingPoolMock,
  OwnedUpgradeabilityProxy,
  RegistryMock,
  SimpleLiquidatorMock,
  TrueUSD,
} from '../build'
import {parseEther} from 'ethers/utils'

use(solidity)

describe('TrueRewardBackedToken', function () {
  let owner: Wallet, holder: Wallet, holder2: Wallet, sender: Wallet, receipient: Wallet
  let token: Contract
  let financialOpportunity: Contract

  describe('with AssuredFinancial opportunity', () => {
    const mockPoolAddress = Wallet.createRandom().address

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, receipient] = wallets)

      token = await deployContract(owner, TrueUSD, [], { gasLimit: 5_000_000 })
      await token.mint(holder.address, parseEther('100'))

      const fractionalExponents = await deployContract(owner, FractionalExponents)
      const liquidator = await deployContract(owner, SimpleLiquidatorMock, [token.address])
      await token.mint(liquidator.address, parseEther('1000'))

      const configurableFinancialOpportunity = await deployContract(owner, ConfigurableFinancialOpportunityMock, [token.address])
      await token.mint(configurableFinancialOpportunity.address, parseEther('100'))

      financialOpportunity = await deployContract(owner, AssuredFinancialOpportunity)
      await financialOpportunity.configure(
        configurableFinancialOpportunity.address,
        mockPoolAddress,
        liquidator.address,
        fractionalExponents.address,
        token.address,
        token.address,
      )
      await token.setAaveInterfaceAddress(financialOpportunity.address)
    })

    it('enables trueReward with 0 balance', async () => {
      expect(await token.trueRewardEnabled(holder2.address)).to.be.false
      await token.connect(holder2).enableTrueReward()
      expect(await token.trueRewardEnabled(holder2.address)).to.be.true
    })

    it('enables trueReward with 100 balance', async () => {
      await token.connect(holder).enableTrueReward()
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('1300'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('disables trueReward', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await token.connect(holder).enableTrueReward()
      expect(await token.trueRewardEnabled(holder.address)).to.be.true
      await expect(token.connect(holder).disableTrueReward()).to.emit(financialOpportunity, 'withdrawToSuccess').withArgs(holder.address, parseEther('100'))
      expect(await token.trueRewardEnabled(holder.address)).to.be.false
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(0)
      expect(await token.totalAaveSupply()).to.equal(0)
      expect(await token.totalSupply()).to.equal(parseEther('1200'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })
  })

  describe('TrueReward with Aave', function () {
    let sharesToken: Contract
    let lendingPoolCore: Contract
    let lendingPool: Contract

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, receipient] = wallets)
      const registry = await deployContract(owner, RegistryMock)
      token = await deployContract(owner, TrueUSD, [], { gasLimit: 5_000_000 })

      await token.mint(holder.address, parseEther('300'))
      await token.setRegistry(registry.address)
      lendingPoolCore = await deployContract(owner, LendingPoolCoreMock)
      sharesToken = await deployContract(owner, ATokenMock, [token.address, lendingPoolCore.address])
      lendingPool = await deployContract(owner, LendingPoolMock, [lendingPoolCore.address, sharesToken.address])

      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))

      const financialOpportunityImpl = await deployContract(owner, AaveFinancialOpportunity)
      const financialOpportunityProxy = await deployContract(owner, OwnedUpgradeabilityProxy)
      financialOpportunity = financialOpportunityImpl.attach(financialOpportunityProxy.address)
      await financialOpportunityProxy.upgradeTo(financialOpportunityImpl.address)
      await financialOpportunity.configure(sharesToken.address, lendingPool.address, token.address, token.address)
      await token.setAaveInterfaceAddress(financialOpportunity.address)
    })

    it('enables truereward', async function () {
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(0)
      await token.connect(holder).enableTrueReward()
      expect(await financialOpportunity.perTokenValue()).to.equal(parseEther('1'))
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('100'))
      expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      expect(await token.accountTotalLoanBackedBalance(holder.address)).to.equal(parseEther('100'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('100'))
      expect(await token.totalSupply()).to.equal(parseEther('400'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
    })

    it('two accounts enable truereward', async function () {
      await token.connect(holder).enableTrueReward()
      await token.connect(holder2).enableTrueReward()
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('200'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('200'))
      expect(await token.totalSupply()).to.equal(parseEther('500'))
    })

    it('balance increases after perTokenValue increases', async () => {
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
      await token.connect(holder).enableTrueReward()
      expect(await token.balanceOf(holder.address)).to.equal('99999999999999999999')
      await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
      expect(await token.balanceOf(holder.address)).to.equal('106666666666666666665')
    })

    it('transfer between accounts without truereward', async () => {
      const asHolder = token.connect(holder)
      await asHolder.transfer(receipient.address, parseEther('42'))
      expect(await token.balanceOf(receipient.address)).to.equal(parseEther('42'))
      expect(await token.balanceOf(holder.address)).to.equal(parseEther('58'))
    })

    it.only('sender truereward enabled receipient not enabled perTokenValue = 1', async () => {
      await token.connect(holder).transfer(sender.address, parseEther('100'))
      await token.enableTrueReward()
      await token.connect(sender).transfer(receipient.address, parseEther('50'))
      expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
      expect(await token.balanceOf(receipient.address)).to.equal(parseEther('50'))
      expect(await token.accountTotalLoanBackedBalance(sender.address)).to.equal(parseEther('50'))
      expect(await token.totalAaveSupply()).to.equal(parseEther('50'))
      expect(await token.totalSupply()).to.equal(parseEther('350'))
      expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal(parseEther('350'))
    })

    it('sender truereward enabled receipient enabled perTokenValue = 1', async function () {
      await token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.enableTrueReward({ from: sender })
      await this.token.enableTrueReward({ from: receipient })
      await this.token.transfer(receipient, to18Decimals(50), { from: sender })
      // console.log(logs)
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(receipient)
      const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
      const totalAaveSupply = await this.token.totalAaveSupply.call()
      const totalSupply = await this.token.totalSupply.call()
      const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
      assert.equal(Number(senderBalance), to18Decimals(50))
      assert.equal(Number(receipientBalance), to18Decimals(50))
      assert.equal(Number(loanBackedTokenBalance), to18Decimals(50))
      assert.equal(Number(totalAaveSupply), to18Decimals(100))
      assert.equal(Number(totalSupply), to18Decimals(400))
      assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(100))
    })

    it('sender truereward not enabled receipient enabled perTokenValue = 1', async function () {
      await this.token.transfer(sender, to18Decimals(100), { from: holder })
      await this.token.enableTrueReward({ from: receipient })
      await this.token.transfer(receipient, to18Decimals(50), { from: sender })
      // console.log(logs)
      const senderBalance = await this.token.balanceOf.call(sender)
      const receipientBalance = await this.token.balanceOf.call(receipient)
      const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
      const totalAaveSupply = await this.token.totalAaveSupply.call()
      const totalSupply = await this.token.totalSupply.call()
      const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
      assert.equal(Number(senderBalance), to18Decimals(50))
      assert.equal(Number(receipientBalance), to18Decimals(50))
      assert.equal(Number(loanBackedTokenBalance), to18Decimals(50))
      assert.equal(Number(totalAaveSupply), to18Decimals(50))
      assert.equal(Number(totalSupply), to18Decimals(350))
      assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(50))
    })

    describe('Truereward - pertokenvalue != 1 ', function () {
      it('sender truereward enabled receipient not enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: sender })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        // console.log(logs)
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const loanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), to18Decimals(50))
        assert.equal(Number(receipientBalance), to18Decimals(50))
        assert.equal(Number(loanBackedTokenBalance), 33333333333333330000) // 50 / 1.5
        assert.equal(Number(totalAaveSupply), 33333333333333330000)
        assert.equal(Number(totalSupply), to18Decimals(350))
        assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(50))
      })

      it('sender truereward enabled receipient enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: sender })
        await this.token.enableTrueReward({ from: receipient })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), to18Decimals(50))
        assert.equal(Number(receipientBalance), to18Decimals(50))
        assert.equal(Number(senderLoanBackedTokenBalance), 33333333333333330000)
        assert.equal(Number(receipientLoanBackedTokenBalance), 33333333333333330000)
        assert.equal(Number(totalAaveSupply), 66666666666666660000)
        assert.equal(Number(totalSupply), to18Decimals(400))
        assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(100))
      })

      it('sender truereward not enabled receipient enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: receipient })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        // console.log(logs)
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), to18Decimals(50))
        assert.equal(Number(receipientBalance), to18Decimals(50))
        assert.equal(Number(senderLoanBackedTokenBalance), 0)
        assert.equal(Number(receipientLoanBackedTokenBalance), 33333333333333330000)
        assert.equal(Number(totalAaveSupply), 33333333333333330000)
        assert.equal(Number(totalSupply), to18Decimals(350))
        assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(50))
      })
    })
    describe('Truereward - aave with interest ', function () {
      it('sender truereward enabled receipient not enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: sender })
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), 56666666666666660000) // (100/1.5)*1.6 - 50
        assert.equal(Number(receipientBalance), to18Decimals(50))
        assert.equal(Number(senderLoanBackedTokenBalance), 35416666666666670000) // 56666666666666660000/1.6
        assert.equal(Number(receipientLoanBackedTokenBalance), 0)
        assert.equal(Number(totalAaveSupply), 35416666666666670000)
        assert.equal(Number(totalSupply), 356666666666666700000)
        assert.equal(Number(interfaceSharesTokenBalance), 56666666666666660000)
      })

      it('sender truereward enabled receipient enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: sender })
        await this.token.enableTrueReward({ from: receipient })
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), 56666666666666660000)
        assert.equal(Number(receipientBalance), 50000000000000000000)
        assert.equal(Number(senderLoanBackedTokenBalance), 35416666666666670000)
        assert.equal(Number(receipientLoanBackedTokenBalance), 31250000000000000000)
        assert.equal(Number(totalAaveSupply), 66666666666666660000)
        assert.equal(Number(totalSupply), 406666666666666700000)
        assert.equal(Number(interfaceSharesTokenBalance), 106666666666666670000)
      })

      it('sender truereward not enabled receipient enabled', async function () {
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.5), { from: owner })
        await this.token.transfer(sender, to18Decimals(100), { from: holder })
        await this.token.enableTrueReward({ from: receipient })
        await this.lendingPoolCore.setReserveNormalizedIncome(to27Decimals(1.6), { from: owner })
        await this.token.transfer(receipient, to18Decimals(50), { from: sender })
        const senderBalance = await this.token.balanceOf.call(sender)
        const receipientBalance = await this.token.balanceOf.call(receipient)
        const senderLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(sender)
        const receipientLoanBackedTokenBalance = await this.token.accountTotalLoanBackedBalance.call(receipient)
        const totalAaveSupply = await this.token.totalAaveSupply.call()
        const totalSupply = await this.token.totalSupply.call()
        const interfaceSharesTokenBalance = await this.sharesToken.balanceOf.call(this.financialOpportunity.address)
        assert.equal(Number(senderBalance), to18Decimals(50))
        assert.equal(Number(receipientBalance), to18Decimals(50))
        assert.equal(Number(senderLoanBackedTokenBalance), 0)
        assert.equal(Number(receipientLoanBackedTokenBalance), to18Decimals(31.25)) // 31.25*1.6
        assert.equal(Number(totalAaveSupply), to18Decimals(31.25))
        assert.equal(Number(totalSupply), to18Decimals(350))
        assert.equal(Number(interfaceSharesTokenBalance), to18Decimals(50))
      })
    })
  })
})
