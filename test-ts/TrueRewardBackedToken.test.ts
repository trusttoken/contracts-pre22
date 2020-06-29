import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ContractTransaction, Wallet } from 'ethers'
import { AddressZero } from 'ethers/constants'
import { BigNumberish, parseEther, Transaction } from 'ethers/utils'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { ATokenMock } from '../build/types/ATokenMock'
import { FinancialOpportunity } from '../build/types/FinancialOpportunity'
import { LendingPoolCoreMock } from '../build/types/LendingPoolCoreMock'
import { RegistryMock } from '../build/types/RegistryMock'
import { SimpleLiquidatorMock } from '../build/types/SimpleLiquidatorMock'
import { TrueRewardBackedToken } from '../build/types/TrueRewardBackedToken'
import { RegistryAttributes } from '../scripts/attributes'
import { fixtureWithAave } from './fixtures/fixtureWithAave'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import {
  expectBurnEventOn,
  expectEvent,
  expectEventsCountOn,
  expectMintEventOn,
  expectTransferEventOn,
} from './utils/eventHelpers'

use(solidity)

describe('TrueRewardBackedToken', () => {
  let owner: Wallet, holder: Wallet, holder2: Wallet, sender: Wallet, recipient: Wallet, notWhitelisted: Wallet, empty: Wallet
  let token: TrueRewardBackedToken
  let registry: RegistryMock
  let financialOpportunity: FinancialOpportunity
  const WHITELIST_TRUEREWARD = RegistryAttributes.isTrueRewardsWhitelisted.hex

  const expectTransferEventWith = async (tx: Transaction, from: string, to: string, amount: BigNumberish) => expectTransferEventOn(token)(tx, from, to, amount)
  const expectBurnEventWith = async (tx: Transaction, from: string, amount: BigNumberish) => expectBurnEventOn(token)(tx, from, amount)
  const expectMintEventWith = async (tx: Transaction, to: string, amount: BigNumberish) => expectMintEventOn(token)(tx, to, amount)
  const expectEventsCount = async (eventName: string, tx: ContractTransaction, count: number) => expectEventsCountOn(token)(eventName, tx, count)

  context('with Aave and AssuredFinancialOpportunity', () => {
    let lendingPoolCore: LendingPoolCoreMock
    let sharesToken: ATokenMock
    let aaveFinancialOpportunity: AaveFinancialOpportunity

    beforeEachWithFixture(async (provider, wallets) => {
      ([owner, holder, holder2, sender, recipient, empty, notWhitelisted] = wallets)
      let liquidator: SimpleLiquidatorMock
      ;({ token, registry, lendingPoolCore, sharesToken, aaveFinancialOpportunity, financialOpportunity, liquidator } = await fixtureWithAave(owner))
      await token.mint(liquidator.address, parseEther('1000'))
      await token.mint(holder.address, parseEther('300'))
      await token.connect(holder).transfer(sharesToken.address, parseEther('100'))
      await token.connect(holder).transfer(holder2.address, parseEther('100'))
    })

    context('before opportunity address set & no whitelisted', () => {
      it('total supply', async () => {
        expect(await token.totalSupply()).to.equal(parseEther('1300'))
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal(parseEther('0'))
      })
      it('balanceOf', async () => {
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
        expect(await token.balanceOf(holder2.address)).to.equal(parseEther('100'))
      })
      it('trueRewardEnabled false for accounts with balance', async () => {
        expect(await token.trueRewardEnabled(holder2.address)).to.be.false
        await expect(token.connect(holder2).enableTrueReward()).to.be.revertedWith(
          'must be whitelisted to enable TrueRewards')
        expect(await token.trueRewardEnabled(holder2.address)).to.be.false
      })
      it('transfers working', async () => {
        await token.connect(holder).transfer(holder2.address, parseEther('100'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('0'))
        expect(await token.balanceOf(holder2.address)).to.equal(parseEther('200'))

        await token.connect(holder2).transfer(holder.address, parseEther('200'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('200'))
        expect(await token.balanceOf(holder2.address)).to.equal(parseEther('0'))
      })
    })

    context('after opportunity address set', () => {
      beforeEach(async () => {
        // set opportuniy
        await token.setOpportunityAddress(financialOpportunity.address)
        await registry.setAttributeValue(owner.address, WHITELIST_TRUEREWARD, 1)
        await registry.setAttributeValue(holder.address, WHITELIST_TRUEREWARD, 1)
        await registry.setAttributeValue(holder2.address, WHITELIST_TRUEREWARD, 1)
        await registry.setAttributeValue(sender.address, WHITELIST_TRUEREWARD, 1)
        await registry.setAttributeValue(recipient.address, WHITELIST_TRUEREWARD, 1)
        await registry.setAttributeValue(empty.address, WHITELIST_TRUEREWARD, 1)
      })

      it('total supply', async () => {
        expect(await token.totalSupply()).to.equal(parseEther('1300'))
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal(parseEther('0'))
      })

      it('holder enables and disables trueReward with 0 balance', async () => {
        expect(await token.trueRewardEnabled(empty.address)).to.be.false
        await token.connect(empty).enableTrueReward()
        expect(await token.trueRewardEnabled(empty.address)).to.be.true
        await token.connect(empty).disableTrueReward()
        expect(await token.trueRewardEnabled(empty.address)).to.be.false
      })

      it('no Transfer events are emitted when holder enables and disables trueReward with 0 balance', async () => {
        await expect(token.connect(empty).enableTrueReward()).to.not.emit(token, 'Transfer')
        await expect(token.connect(empty).disableTrueReward()).to.not.emit(token, 'Transfer')
      })

      it('holder enables trueReward with 100 balance', async () => {
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(0)
        await token.connect(holder).enableTrueReward()
        expect(await token.trueRewardEnabled(holder.address)).to.be.true
        expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(parseEther('100'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
        expect(await token.totalSupply()).to.equal(parseEther('1400'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal(parseEther('100'))

        expect(await financialOpportunity.tokenValue()).to.equal(parseEther('1'))
        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
        expect(await token.balanceOf(financialOpportunity.address)).to.equal(0)
      })

      it('emits correct events when true rewards are enabled', async () => {
        const tx = await token.connect(holder).enableTrueReward()
        await expectEvent(token, 'TrueRewardEnabled')(tx, holder.address, parseEther('100'), financialOpportunity.address)
        await expectTransferEventWith(tx, holder.address, financialOpportunity.address, parseEther('100'))
        await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, parseEther('100'))
        await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, parseEther('100'))
        await expectTransferEventWith(tx, AddressZero, holder.address, parseEther('100'))
        await expectMintEventWith(tx, holder.address, parseEther('100'))
        await expectEventsCount('Transfer', tx, 4)
        await expectEventsCount('Mint', tx, 1)
      })

      it('holder disables trueReward', async () => {
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
        await expect(token.connect(holder).enableTrueReward()).to.emit(financialOpportunity, 'Deposit').withArgs(holder.address, parseEther('100'), parseEther('100'))
        expect(await token.trueRewardEnabled(holder.address)).to.be.true
        await expect(token.connect(holder).disableTrueReward()).to.emit(financialOpportunity, 'Redemption').withArgs(holder.address, parseEther('100'), parseEther('100'))
        expect(await token.trueRewardEnabled(holder.address)).to.be.false
        expect(await token.rewardTokenBalance(holder.address, financialOpportunity.address)).to.equal(0)
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(0)
        expect(await token.totalSupply()).to.equal(parseEther('1300'))
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal(parseEther('0'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
      })

      it('emits correct events when true rewards are disabled', async () => {
        await token.connect(holder).enableTrueReward()
        const tx = await token.connect(holder).disableTrueReward()

        await expectEvent(token, 'TrueRewardDisabled')(tx, holder.address, parseEther('100'), financialOpportunity.address)

        // Should be lendingPool instead of sharesToken with full AAVE integration
        await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, parseEther('100'))
        await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, parseEther('100'))
        await expectTransferEventWith(tx, financialOpportunity.address, holder.address, parseEther('100'))
        await expectTransferEventWith(tx, holder.address, AddressZero, parseEther('100'))
        await expectBurnEventWith(tx, holder.address, parseEther('100'))

        await expectEventsCount('Transfer', tx, 4)
        await expectEventsCount('Burn', tx, 1)
      })

      it('holder fails to enable trueReward when not whitelisted', async () => {
        expect(await token.trueRewardEnabled(notWhitelisted.address)).to.be.false

        await expect(token.connect(notWhitelisted).enableTrueReward()).to.be.revertedWith(
          'must be whitelisted to enable TrueRewards')
        expect(await token.trueRewardEnabled(notWhitelisted.address)).to.be.false
      })

      it('two holders each with 100 enable truereward', async () => {
        await token.connect(holder).enableTrueReward()
        await token.connect(holder2).enableTrueReward()

        expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('200'))
        expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('200'))
        expect(await token.totalSupply()).to.equal(parseEther('1500'))
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal(parseEther('200'))
      })

      it('holders balance increases after tokenValue increases', async () => {
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).enableTrueReward()
        expect(await token.balanceOf(holder.address)).to.equal('99999999999999999999')
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        expect(await token.balanceOf(holder.address)).to.equal('106666666666666666665')
      })

      it('total supply calculated correctly after tokenValue increases', async () => {
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
        await token.connect(holder).enableTrueReward()
        // test supply before increasing
        expect(await token.totalSupply()).to.equal('1399999999999999999999')
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal('99999999999999999999')
        // increase token value
        await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
        // test supply after increasing
        expect(await token.totalSupply()).to.equal('1406666666666666666665')
        expect(await token.depositBackedSupply()).to.equal(parseEther('1300'))
        expect(await token.rewardBackedSupply()).to.equal('106666666666666666665')
      })

      it('holders with truereward disabled transfer funds between each other', async () => {
        const asHolder = token.connect(holder)
        await asHolder.transfer(recipient.address, parseEther('42'))
        expect(await token.balanceOf(recipient.address)).to.equal(parseEther('42'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('58'))
      })

      it('emits single transfer event when holders with truereward disabled transfer funds between each other', async () => {
        const asHolder = token.connect(holder)
        const tx = await asHolder.transfer(recipient.address, parseEther('42'))
        await expectTransferEventWith(tx, holder.address, recipient.address, parseEther('42'))
        await expectEventsCount('Transfer', tx, 1)
        await expectEventsCount('Burn', tx, 0)
        await expectEventsCount('Mint', tx, 0)
      })

      it('minting for account with trueReward enabled', async () => {
        await token.connect(sender).enableTrueReward()
        await token.mint(sender.address, parseEther('1.5'))
        expect(await token.balanceOf(sender.address)).to.equal(parseEther('1.5'))
        expect(await token.trueRewardEnabled(sender.address)).to.equal(true)
      })

      it('minting for account with trueReward enabled that had some mints before', async () => {
        await token.connect(holder).enableTrueReward()
        await token.mint(holder.address, parseEther('1.5'))
        expect(await token.balanceOf(holder.address)).to.equal(parseEther('101.5'))
        expect(await token.trueRewardEnabled(holder.address)).to.equal(true)
      })

      it('reverts on transfer to financial opportunity with trueReward enabled', async () => {
        await token.connect(holder).enableTrueReward()
        await expect(token.connect(holder).transfer(financialOpportunity.address, 1)).to.be.revertedWith('not enough balance')
      })

      describe('tokenValue == 1', () => {
        beforeEach(async () => {
          await token.connect(holder).transfer(sender.address, parseEther('100'))
        })

        it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
          await token.connect(sender).enableTrueReward()
          expect(await token.totalSupply()).to.equal(parseEther('1400'))

          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
          expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
          expect(await token.totalSupply()).to.equal(parseEther('1350'))
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
        })

        it('emits correct events when sender with truereward enabled sends to recipient with truereward disabled', async () => {
          const amount = parseEther('50')
          await token.connect(sender).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, amount)
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, amount)
          await expectTransferEventWith(tx, financialOpportunity.address, sender.address, amount)
          await expectTransferEventWith(tx, sender.address, AddressZero, amount)
          await expectBurnEventWith(tx, sender.address, amount)
          await expectTransferEventWith(tx, sender.address, recipient.address, amount)

          await expectEventsCount('Transfer', tx, 5)
          await expectEventsCount('Burn', tx, 1)
          await expectEventsCount('Mint', tx, 0)
        })

        it('holders with truereward enabled transfer funds between each other', async () => {
          await token.connect(sender).enableTrueReward()
          await token.connect(recipient).enableTrueReward()
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
          expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
          expect(await token.totalSupply()).to.equal(parseEther('1400'))
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
        })

        it('emits correct events when truereward enabled transfer funds between each other', async () => {
          const amount = parseEther('50')
          await token.connect(sender).enableTrueReward()
          await token.connect(recipient).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, amount)
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, amount)
          await expectTransferEventWith(tx, financialOpportunity.address, sender.address, amount)
          await expectTransferEventWith(tx, sender.address, AddressZero, amount)
          await expectBurnEventWith(tx, sender.address, amount)
          await expectTransferEventWith(tx, sender.address, recipient.address, amount)
          await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
          await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
          await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
          await expectMintEventWith(tx, recipient.address, amount)

          await expectEventsCount('Transfer', tx, 9)
          await expectEventsCount('Burn', tx, 1)
          await expectEventsCount('Mint', tx, 1)
        })

        it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
          await token.connect(recipient).enableTrueReward()
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
          expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
          expect(await token.totalSupply()).to.equal(parseEther('1350'))
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
        })

        it('emits correct events when truereward disabled sends to recipient with truereward enabled', async () => {
          const amount = parseEther('50')
          await token.connect(recipient).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sender.address, recipient.address, amount)
          await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
          await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
          await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
          await expectMintEventWith(tx, recipient.address, amount)

          await expectEventsCount('Transfer', tx, 5)
          await expectEventsCount('Burn', tx, 0)
          await expectEventsCount('Mint', tx, 1)
        })

        describe('transferFrom', () => {
          beforeEach(async () => {
            await token.connect(sender).approve(owner.address, parseEther('50'))
          })

          it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
            await token.connect(sender).enableTrueReward()
            expect(await token.totalSupply()).to.equal(parseEther('1400'))

            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
            expect(await token.totalSupply()).to.equal(parseEther('1350'))
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
          })

          it('emits correct events when sender with truereward enabled sends to recipient with truereward disabled', async () => {
            const amount = parseEther('50')
            await token.connect(sender).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, amount)
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, amount)
            await expectTransferEventWith(tx, financialOpportunity.address, sender.address, amount)
            await expectTransferEventWith(tx, sender.address, AddressZero, amount)
            await expectBurnEventWith(tx, sender.address, amount)
            await expectTransferEventWith(tx, sender.address, recipient.address, amount)

            await expectEventsCount('Transfer', tx, 5)
            await expectEventsCount('Burn', tx, 1)
            await expectEventsCount('Mint', tx, 0)
          })

          it('fails to transfer above approved amount', async () => {
            await token.connect(sender).enableTrueReward()
            await expect(token.transferFrom(sender.address, recipient.address, parseEther('50').add(1))).to.be.revertedWith('subtraction overflow')
          })

          it('holders with truereward enabled transfer funds between each other', async () => {
            await token.connect(sender).enableTrueReward()
            await token.connect(recipient).enableTrueReward()
            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('100'))
            expect(await token.totalSupply()).to.equal(parseEther('1400'))
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('100'))
          })

          it('emits correct events when truereward enabled transfer funds between each other', async () => {
            const amount = parseEther('50')
            await token.connect(sender).enableTrueReward()
            await token.connect(recipient).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, amount)
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, amount)
            await expectTransferEventWith(tx, financialOpportunity.address, sender.address, amount)
            await expectTransferEventWith(tx, sender.address, AddressZero, amount)
            await expectBurnEventWith(tx, sender.address, amount)
            await expectTransferEventWith(tx, sender.address, recipient.address, amount)
            await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
            await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
            await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
            await expectMintEventWith(tx, recipient.address, amount)

            await expectEventsCount('Transfer', tx, 9)
            await expectEventsCount('Burn', tx, 1)
            await expectEventsCount('Mint', tx, 1)
          })

          it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
            await token.connect(recipient).enableTrueReward()
            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
            expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('50'))
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('50'))
            expect(await token.totalSupply()).to.equal(parseEther('1350'))
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
          })

          it('emits correct events when truereward disabled sends to recipient with truereward enabled', async () => {
            const amount = parseEther('50')
            await token.connect(recipient).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sender.address, recipient.address, amount)
            await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
            await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
            await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
            await expectMintEventWith(tx, recipient.address, amount)

            await expectEventsCount('Transfer', tx, 5)
            await expectEventsCount('Burn', tx, 0)
            await expectEventsCount('Mint', tx, 1)
          })
        })
      })

      describe('tokenValue != 1', () => {
        beforeEach(async () => {
          await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
          await token.connect(holder).transfer(sender.address, parseEther('100'))
        })

        it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
          await token.connect(sender).enableTrueReward()
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address), 'sender').to.equal('49999999999999999999')
          expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999998')
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333') // 50 / 1.5
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
          expect(await token.totalSupply()).to.equal('1349999999999999999999')
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address), 'shares').to.equal('50000000000000000001')
        })

        it('emits correct events when sender with truereward enabled sends to recipient with truereward disabled', async () => {
          const amount = parseEther('50')
          await token.connect(sender).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, financialOpportunity.address, sender.address, '49999999999999999998')
          await expectTransferEventWith(tx, sender.address, AddressZero, '49999999999999999998')
          await expectBurnEventWith(tx, sender.address, '49999999999999999998')
          await expectTransferEventWith(tx, sender.address, recipient.address, '49999999999999999998')

          await expectEventsCount('Transfer', tx, 5)
          await expectEventsCount('Burn', tx, 1)
          await expectEventsCount('Mint', tx, 0)
        })

        it('holders with truereward enabled transfer funds between each other', async () => {
          await token.connect(sender).enableTrueReward()
          await token.connect(recipient).enableTrueReward()
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
          expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999998')
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333')
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333332')
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666665')
          expect(await token.totalSupply()).to.equal('1399999999999999999997')
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('99999999999999999999')
        })

        it('emits correct events when holders with truereward enabled transfer funds between each other', async () => {
          const amount = parseEther('50')
          await token.connect(sender).enableTrueReward()
          await token.connect(recipient).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, financialOpportunity.address, sender.address, '49999999999999999998')
          await expectTransferEventWith(tx, sender.address, AddressZero, '49999999999999999998')
          await expectBurnEventWith(tx, sender.address, '49999999999999999998')
          await expectTransferEventWith(tx, sender.address, recipient.address, '49999999999999999998')
          await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, '49999999999999999998')
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, '49999999999999999998')
          await expectTransferEventWith(tx, AddressZero, recipient.address, '49999999999999999998')
          await expectMintEventWith(tx, recipient.address, '49999999999999999998')

          await expectEventsCount('Transfer', tx, 9)
          await expectEventsCount('Burn', tx, 1)
          await expectEventsCount('Mint', tx, 1)
        })

        it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
          await token.connect(recipient).enableTrueReward()
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
          expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333333')
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
          expect(await token.totalSupply()).to.equal('1349999999999999999999')
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('49999999999999999999')
        })

        it('emits correct events when sender with truereward disabled sends to recipient with truereward enabled', async () => {
          const amount = parseEther('50')
          await token.connect(recipient).enableTrueReward()
          const tx = await token.connect(sender).transfer(recipient.address, amount)

          await expectTransferEventWith(tx, sender.address, recipient.address, amount)
          await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
          await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
          await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
          await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
          await expectMintEventWith(tx, recipient.address, amount)

          await expectEventsCount('Transfer', tx, 5)
          await expectEventsCount('Burn', tx, 0)
          await expectEventsCount('Mint', tx, 1)
        })

        describe('transferFrom', () => {
          beforeEach(async () => {
            await token.connect(sender).approve(owner.address, parseEther('50'))
          })

          it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
            await token.connect(sender).enableTrueReward()
            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address), 'sender').to.equal('49999999999999999999')
            expect(await token.balanceOf(recipient.address), 'recipient').to.equal('49999999999999999998')
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333') // 50 / 1.5
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
            expect(await token.totalSupply()).to.equal('1349999999999999999999')
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address), 'shares').to.equal('50000000000000000001')
          })

          it('emits correct events when sender with truereward enabled sends to recipient with truereward disabled', async () => {
            const amount = parseEther('50')
            await token.connect(sender).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, financialOpportunity.address, sender.address, '49999999999999999998')
            await expectTransferEventWith(tx, sender.address, AddressZero, '49999999999999999998')
            await expectBurnEventWith(tx, sender.address, '49999999999999999998')
            await expectTransferEventWith(tx, sender.address, recipient.address, '49999999999999999998')

            await expectEventsCount('Transfer', tx, 5)
            await expectEventsCount('Burn', tx, 1)
            await expectEventsCount('Mint', tx, 0)
          })

          it('fails to transfer above approved amount', async () => {
            await token.connect(sender).enableTrueReward()
            await expect(token.transferFrom(sender.address, recipient.address, parseEther('50').add(1))).to.be.revertedWith('subtraction overflow')
          })

          it('holders with truereward enabled transfer funds between each other', async () => {
            await token.connect(sender).enableTrueReward()
            await token.connect(recipient).enableTrueReward()
            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address)).to.equal('49999999999999999999')
            expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999998')
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('33333333333333333333')
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333332')
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666665')
            expect(await token.totalSupply()).to.equal('1399999999999999999997')
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('99999999999999999999')
          })

          it('emits correct events when holders with truereward enabled transfer funds between each other', async () => {
            const amount = parseEther('50')
            await token.connect(sender).enableTrueReward()
            await token.connect(recipient).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, financialOpportunity.address, sender.address, '49999999999999999998')
            await expectTransferEventWith(tx, sender.address, AddressZero, '49999999999999999998')
            await expectBurnEventWith(tx, sender.address, '49999999999999999998')
            await expectTransferEventWith(tx, sender.address, recipient.address, '49999999999999999998')
            await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, '49999999999999999998')
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, '49999999999999999998')
            await expectTransferEventWith(tx, AddressZero, recipient.address, '49999999999999999998')
            await expectMintEventWith(tx, recipient.address, '49999999999999999998')

            await expectEventsCount('Transfer', tx, 9)
            await expectEventsCount('Burn', tx, 1)
            await expectEventsCount('Mint', tx, 1)
          })

          it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
            await token.connect(recipient).enableTrueReward()
            await token.transferFrom(sender.address, recipient.address, parseEther('50'))

            expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
            expect(await token.balanceOf(recipient.address)).to.equal('49999999999999999999')
            expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
            expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('33333333333333333333')
            expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('33333333333333333333')
            expect(await token.totalSupply()).to.equal('1349999999999999999999')
            expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('49999999999999999999')
          })

          it('emits correct events when sender with truereward disabled sends to recipient with truereward enabled', async () => {
            const amount = parseEther('50')
            await token.connect(recipient).enableTrueReward()
            const tx = await token.transferFrom(sender.address, recipient.address, amount)

            await expectTransferEventWith(tx, sender.address, recipient.address, amount)
            await expectTransferEventWith(tx, recipient.address, financialOpportunity.address, amount)
            await expectTransferEventWith(tx, financialOpportunity.address, aaveFinancialOpportunity.address, amount)
            await expectTransferEventWith(tx, aaveFinancialOpportunity.address, lendingPoolCore.address, amount)
            await expectTransferEventWith(tx, AddressZero, recipient.address, amount)
            await expectMintEventWith(tx, recipient.address, amount)

            await expectEventsCount('Transfer', tx, 5)
            await expectEventsCount('Burn', tx, 0)
            await expectEventsCount('Mint', tx, 1)
          })
        })
      })

      describe('Aave earns interest', () => {
        beforeEach(async () => {
          await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
          await token.connect(holder).transfer(sender.address, parseEther('100'))
        })

        it('sender with truereward enabled sends to recipient with truereward disabled', async () => {
          await token.connect(sender).enableTrueReward()
          await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665') // (100/1.5)*1.6 - 50
          expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666') // 56666666666666660000/1.6
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('35416666666666666666')
          expect(await token.totalSupply()).to.equal('1356666666666666666665')
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('56666666666666666666')
        })

        it('holders with truereward enabled transfer funds between each other', async () => {
          await token.connect(sender).enableTrueReward()
          await token.connect(recipient).enableTrueReward()
          await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal('56666666666666666665')
          expect(await token.balanceOf(recipient.address)).to.equal('50000000000000000000')
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('35416666666666666666')
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('31250000000000000000')
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal('66666666666666666666')
          expect(await token.totalSupply()).to.equal('1406666666666666666665')
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal('106666666666666666666')
        })

        it('sender with truereward disabled sends to recipient with truereward enabled', async () => {
          await token.connect(recipient).enableTrueReward()
          await lendingPoolCore.setReserveNormalizedIncome(parseEther('1600000000'))
          await token.connect(sender).transfer(recipient.address, parseEther('50'))

          expect(await token.balanceOf(sender.address)).to.equal(parseEther('50'))
          expect(await token.balanceOf(recipient.address)).to.equal(parseEther('50'))
          expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(0)
          expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('31.25')) // 31.25*1.6
          expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('31.25'))
          expect(await token.totalSupply()).to.equal(parseEther('1350'))
          expect(await sharesToken.balanceOf(aaveFinancialOpportunity.address)).to.equal(parseEther('50'))
        })
      })

      describe('Using reserve mechanism', () => {
        let reserveAddress: string

        beforeEach(async () => {
          reserveAddress = await token.RESERVE()
        })

        describe('enabling true rewards', () => {
          beforeEach(async () => {
            await token.mint(reserveAddress, parseEther('100'))
            await token.opportunityReserveMint(parseEther('100'))
          })

          it('tokenValue = 1', async () => {
            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(parseEther('100'))
            expect(await token.balanceOf(reserveAddress)).to.equal(0)
            await token.connect(holder).enableTrueReward()
            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(0)
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('100'))

            expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
          })

          it('tokenValue > 1', async () => {
            await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))

            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(parseEther('100'))
            await token.connect(holder).enableTrueReward()
            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(parseEther('100').div(3).add(1))
            expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('100'))

            expect(await token.balanceOf(holder.address)).to.equal(parseEther('100').sub(1))
          })

          it('emits correct events', async () => {
            const tx = await token.connect(holder).enableTrueReward()

            await expectEvent(token, 'TrueRewardEnabled')(tx, holder.address, parseEther('100'), financialOpportunity.address)
            await expectTransferEventWith(tx, holder.address, reserveAddress, parseEther('100'))
            await expectTransferEventWith(tx, reserveAddress, holder.address, parseEther('100'))

            await expectEventsCount('Transfer', tx, 2)
            await expectEventsCount('Mint', tx, 0)
          })
        })

        describe('disabling true rewards', () => {
          beforeEach(async () => {
            await token.mint(reserveAddress, parseEther('100'))
            await token.opportunityReserveMint(parseEther('100'))
            await token.connect(holder).enableTrueReward()
          })

          it('tokenValue = 1', async () => {
            await token.connect(holder).disableTrueReward()

            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(parseEther('100'))
            expect(await token.balanceOf(reserveAddress)).to.equal(0)
            expect(await token.balanceOf(holder.address)).to.equal(parseEther('100'))
          })

          it('tokenValue > 1', async () => {
            await token.mint(reserveAddress, parseEther('50'))
            await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
            await token.connect(holder).disableTrueReward()

            expect(await token.reserveRewardBalance(financialOpportunity.address)).to.equal(parseEther('100'))
            expect(await token.balanceOf(reserveAddress)).to.equal(0)
            expect(await token.balanceOf(holder.address)).to.equal(parseEther('150'))
          })

          it('emits correct events', async () => {
            const tx = await token.connect(holder).disableTrueReward()

            await expectEvent(token, 'TrueRewardDisabled')(tx, holder.address, parseEther('100'), financialOpportunity.address)
            await expectTransferEventWith(tx, reserveAddress, holder.address, parseEther('100'))
            await expectTransferEventWith(tx, holder.address, reserveAddress, parseEther('100'))

            await expectEventsCount('Transfer', tx, 2)
            await expectEventsCount('Burn', tx, 0)
          })
        })

        describe('Transfers', () => {
          describe('sender with truereward enabled sends to recipient with truereward disabled', async () => {
            beforeEach(async () => {
              await token.connect(holder).transfer(sender.address, parseEther('40'))
              await token.connect(holder).transfer(reserveAddress, parseEther('60'))
              await token.connect(sender).enableTrueReward()
            })

            describe('tokenValue = 1', () => {
              it('total token supply should remain the same', async () => {
                expect(await token.totalSupply()).to.equal(parseEther('1340'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.totalSupply()).to.equal(parseEther('1340'))
              })

              it('token reserve should decrease', async () => {
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('60'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
              })

              it('zToken reserve should increase', async () => {
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
              })

              it('token balance of the sender should decrease', async () => {
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.balanceOf(sender.address)).to.equal('0')
              })

              it('token balance of the recipient should increase', async () => {
                expect(await token.balanceOf(recipient.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.balanceOf(recipient.address)).to.equal(parseEther('40'))
              })

              it('loan backed balance of the sender should decrease', async () => {
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
              })

              it('loan backed balance of the recipient should remain the same', async () => {
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
              })

              it('total aave supply should remain the same', async () => {
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
              })

              it('balance of the shares token should remain the same', async () => {
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
              })

              it('emits transfer events with reserve', async () => {
                const amount = parseEther('40')
                const tx = await token.connect(sender).transfer(recipient.address, amount)
                await expectTransferEventWith(tx, sender.address, reserveAddress, amount)
                await expectTransferEventWith(tx, reserveAddress, sender.address, amount)
                await expectTransferEventWith(tx, sender.address, recipient.address, amount)
                await expectEventsCount('Transfer', tx, 3)
              })
            })

            describe('tokenValue != 1', () => {
              beforeEach(async () => {
                await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
              })

              it('total token supply should remain the same', async () => {
                expect(await token.totalSupply()).to.equal(parseEther('1360'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.totalSupply()).to.equal(parseEther('1360'))
              })

              it('token reserve should decrease', async () => {
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('60'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
              })

              it('zToken reserve should increase', async () => {
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('30'))
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
              })

              it('token balance of the sender should decrease', async () => {
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('60'))
                await token.connect(sender).transfer(recipient.address, parseEther('60'))
                expect(await token.balanceOf(sender.address)).to.equal('0')
              })

              it('token balance of the recipient should increase', async () => {
                expect(await token.balanceOf(recipient.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.balanceOf(recipient.address)).to.equal(parseEther('40'))
              })

              it('loan backed balance of the sender should decrease', async () => {
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('60'))
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
              })

              it('loan backed balance of the recipient should remain the same', async () => {
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
              })

              it('total aave supply should remain the same', async () => {
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
              })

              it('balance of the shares token should remain the same', async () => {
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('40'))
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
              })

              it('emits transfer events with reserve', async () => {
                const amount = parseEther('40')
                const tx = await token.connect(sender).transfer(recipient.address, amount)
                await expectTransferEventWith(tx, sender.address, reserveAddress, amount)
                await expectTransferEventWith(tx, reserveAddress, sender.address, amount)
                await expectTransferEventWith(tx, sender.address, recipient.address, amount)
                await expectEventsCount('Transfer', tx, 3)
              })
            })
          })

          describe('sender with truereward disabled sends to recipient with truereward enabled', async () => {
            beforeEach(async () => {
              await token.connect(holder).transfer(recipient.address, parseEther('40'))
              await token.connect(holder).transfer(reserveAddress, parseEther('60'))
              await token.connect(recipient).enableTrueReward()
              await token.connect(recipient).transfer(sender.address, parseEther('40'))
            })

            describe('tokenValue = 1', () => {
              it('total token supply should remain the same', async () => {
                expect(await token.totalSupply()).to.equal(parseEther('1340'))
                await expect(token.connect(sender).transfer(recipient.address, parseEther('20'))).to.emit(token, 'ReserveDeposit')
                expect(await token.totalSupply()).to.equal(parseEther('1340'))
              })

              it('token reserve should increase', async () => {
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('40'))
              })

              it('zToken reserve should decrease', async () => {
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
              })

              it('token balance of the sender should decrease', async () => {
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('20'))
              })

              it('token balance of the recipient should increase', async () => {
                expect(await token.balanceOf(recipient.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(recipient.address)).to.equal(parseEther('20'))
              })

              it('loan backed balance of the sender should remain the same', async () => {
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
              })

              it('loan backed balance of the recipient should increase', async () => {
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('20'))
              })

              it('total aave supply should remain the same', async () => {
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
              })

              it('balance of the shares token should remain the same', async () => {
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
              })

              it('emits transfer events with reserve', async () => {
                const amount = parseEther('40')
                const tx = await token.connect(sender).transfer(recipient.address, amount)
                await expectTransferEventWith(tx, sender.address, recipient.address, amount)
                await expectTransferEventWith(tx, recipient.address, reserveAddress, amount)
                await expectTransferEventWith(tx, reserveAddress, recipient.address, amount)
                await expectEventsCount('Transfer', tx, 3)
              })
            })

            describe('tokenValue != 1', () => {
              beforeEach(async () => {
                await lendingPoolCore.setReserveNormalizedIncome(parseEther('1500000000'))
              })

              it('total token supply should remain the same', async () => {
                expect(await token.totalSupply()).to.equal(parseEther('1360'))
                await expect(token.connect(sender).transfer(recipient.address, parseEther('20'))).to.emit(token, 'ReserveDeposit')
                expect(await token.totalSupply()).to.equal(parseEther('1360'))
              })

              it('token reserve should increase', async () => {
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('20'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(reserveAddress)).to.equal(parseEther('40'))
              })

              it('zToken reserve should decrease', async () => {
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('30'))
                expect(await token.rewardTokenBalance(reserveAddress, financialOpportunity.address)).to.equal(parseEther('20'))
              })

              it('token balance of the sender should decrease', async () => {
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(sender.address)).to.equal(parseEther('20'))
              })

              it('token balance of the recipient should increase', async () => {
                expect(await token.balanceOf(recipient.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.balanceOf(recipient.address)).to.equal('19999999999999999999')
              })

              it('loan backed balance of the sender should remain the same', async () => {
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenBalance(sender.address, financialOpportunity.address)).to.equal('0')
              })

              it('loan backed balance of the recipient should increase', async () => {
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('30'))
                expect(await token.rewardTokenBalance(recipient.address, financialOpportunity.address)).to.equal(parseEther('20'))
              })

              it('total aave supply should remain the same', async () => {
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await token.rewardTokenSupply(financialOpportunity.address)).to.equal(parseEther('40'))
              })

              it('balance of the shares token should remain the same', async () => {
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
                await token.connect(sender).transfer(recipient.address, parseEther('20'))
                expect(await sharesToken.balanceOf(financialOpportunity.address)).to.equal('0')
              })

              it('emits transfer events with reserve', async () => {
                const amount = parseEther('40')
                const tx = await token.connect(sender).transfer(recipient.address, amount)
                await expectTransferEventWith(tx, sender.address, recipient.address, amount)
                await expectTransferEventWith(tx, recipient.address, reserveAddress, amount)
                await expectTransferEventWith(tx, reserveAddress, recipient.address, amount)
                await expectEventsCount('Transfer', tx, 3)
              })
            })
          })

          describe('sender with truereward enabled sends to recipient with truereward enabled', async () => {
            beforeEach(async () => {
              await token.connect(holder).transfer(sender.address, parseEther('40'))
              await token.connect(holder).transfer(reserveAddress, parseEther('60'))
              await token.connect(sender).enableTrueReward()
              await token.connect(recipient).enableTrueReward()
            })

            it('emits transfer events with reserve', async () => {
              const amount = parseEther('40')
              const tx = await token.connect(sender).transfer(recipient.address, amount)
              await expectTransferEventWith(tx, sender.address, reserveAddress, amount)
              await expectTransferEventWith(tx, reserveAddress, sender.address, amount)
              await expectTransferEventWith(tx, sender.address, recipient.address, amount)
              await expectTransferEventWith(tx, recipient.address, reserveAddress, amount)
              await expectTransferEventWith(tx, reserveAddress, recipient.address, amount)
              await expectEventsCount('Transfer', tx, 5)
            })
          })
        })
      })
    })
  })
})
