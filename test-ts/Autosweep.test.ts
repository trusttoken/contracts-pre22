import { ContractTransaction, ethers, Wallet } from 'ethers'
import { BigNumberish, parseEther, Transaction } from 'ethers/utils'
import { TrueUsd } from '../build/types/TrueUsd'
import { RegistryAttributes } from '../scripts/attributes'
import { fixtureWithAave } from './fixtures/fixtureWithAave'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import { expect } from 'chai'
import { RegistryMock } from '../build/types/RegistryMock'
import { expectRewardBackedBurnEventOn, expectEventsCountOn, expectTransferEventOn } from './utils/eventHelpers'
import { AddressZero } from 'ethers/constants'
import { ATokenMock } from '../build/types/ATokenMock'
import { AaveFinancialOpportunity } from '../build/types/AaveFinancialOpportunity'
import { AssuredFinancialOpportunity } from '../build/types/AssuredFinancialOpportunity'
import { TrueRewards } from '../build/types/TrueRewards'

function toChecksumAddress (address: string) {
  return ethers.utils.getAddress(address.toLowerCase())
}

describe('Autosweep feature', () => {
  let owner: Wallet
  let holder: Wallet
  let autosweepTarget: Wallet
  let token: TrueUsd
  let registry: RegistryMock
  let sharesToken: ATokenMock
  let aaveFinancialOpportunity: AaveFinancialOpportunity
  let financialOpportunity: AssuredFinancialOpportunity
  let trueRewards: TrueRewards

  const expectTransferEventWith = async (tx: Transaction, from: string, to: string, amount: BigNumberish) => expectTransferEventOn(token)(tx, from, to, amount)
  const expectRewardBackedBurnEventWith = async (tx: Transaction, from: string, amount: BigNumberish) => expectRewardBackedBurnEventOn(token)(tx, from, amount)
  const expectEventsCount = async (eventName: string, tx: ContractTransaction, count: number) => expectEventsCountOn(token)(eventName, tx, count)

  beforeEachWithFixture(async (provider, wallets) => {
    ([owner, holder, autosweepTarget] = wallets)
    ;({ token, registry, sharesToken, aaveFinancialOpportunity, financialOpportunity, trueRewards } = await fixtureWithAave(owner))
    await registry.subscribe(RegistryAttributes.isDepositAddress.hex, token.address)
    await token.mint(holder.address, parseEther('200'))
    await token.connect(holder).transfer(sharesToken.address, parseEther('100'))

    await token.setTrueRewardsAddress(trueRewards.address)
    const depositAccount = toChecksumAddress('00000' + autosweepTarget.address.slice(2, 37))
    await registry.setAttributeValue(depositAccount, RegistryAttributes.isDepositAddress.hex, autosweepTarget.address)
  })

  const hasBehavior = (_: string, setup: () => { recipient: string }) => {
    it('sends funds to autosweep address', async () => {
      const { recipient } = setup()
      expect(await token.balanceOf(autosweepTarget.address)).to.eq(parseEther('42'))
      expect(await token.balanceOf(recipient)).to.eq(parseEther('0'))
      expect(await token.balanceOf(holder.address)).to.eq(parseEther('58'))
    })
  }
  context('on transfer without truerewards enabled', () => {
    let tx
    let recipient: string
    beforeEach(async () => {
      recipient = toChecksumAddress(autosweepTarget.address.slice(2, 37) + '00100')
      tx = await token.connect(holder).transfer(recipient, parseEther('42'))
    })

    hasBehavior('sends funds', () => ({ recipient }))

    it('emits 2 transfer events', async () => {
      await expectTransferEventWith(tx, holder.address, recipient, parseEther('42'))
      await expectTransferEventWith(tx, recipient, autosweepTarget.address, parseEther('42'))
      await expectEventsCount('Transfer', tx, 2)
      await expectEventsCount('BurnRewardBackedToken', tx, 0)
      await expectEventsCount('MintRewardBackedToken', tx, 0)
    })
  })

  context('on transfer with truerewards enabled (enabled => disabled)', () => {
    let tx
    let recipient
    beforeEach(async () => {
      recipient = toChecksumAddress(autosweepTarget.address.slice(2, 37) + '00100')
      await registry.setAttributeValue(holder.address, RegistryAttributes.isTrueRewardsWhitelisted.hex, 1)
      await token.connect(holder).enableTrueReward()
      tx = await token.connect(holder).transfer(recipient, parseEther('42'))
    })

    hasBehavior('sends funds', () => ({ recipient }))

    it('emits some transfer events', async () => {
      const amount = parseEther('42')

      await expectTransferEventWith(tx, sharesToken.address, aaveFinancialOpportunity.address, amount)
      await expectTransferEventWith(tx, aaveFinancialOpportunity.address, financialOpportunity.address, amount)
      await expectTransferEventWith(tx, financialOpportunity.address, trueRewards.address, amount)
      await expectTransferEventWith(tx, trueRewards.address, holder.address, amount)
      await expectTransferEventWith(tx, holder.address, AddressZero, amount)
      await expectRewardBackedBurnEventWith(tx, holder.address, amount)
      await expectTransferEventWith(tx, holder.address, recipient, amount)
      await expectTransferEventWith(tx, recipient, autosweepTarget.address, amount)

      await expectEventsCount('Transfer', tx, 7)
      await expectEventsCount('BurnRewardBackedToken', tx, 1)
      await expectEventsCount('MintRewardBackedToken', tx, 0)
    })
  })
})
