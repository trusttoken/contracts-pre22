import { ContractTransaction, ethers, Wallet } from 'ethers'
import { BigNumberish, parseEther, Transaction } from 'ethers/utils'
import { Registry } from '../build/types/Registry'
import { TrueUsd } from '../build/types/TrueUsd'
import { RegistryAttributes } from '../scripts/attributes'
import { fixtureWithAave } from './fixtures/fixtureWithAave'
import { beforeEachWithFixture } from './utils/beforeEachWithFixture'
import { expect } from 'chai'
import { ProvisionalRegistryMock } from '../build/types/ProvisionalRegistryMock'
import { RegistryMock } from '../build/types/RegistryMock'
import { AddressZero } from 'ethers/constants'
import { expectBurnEventOn, expectEventsCountOn, expectMintEventOn, expectTransferEventOn } from './utils/eventHelpers'

function toChecksumAddress (address: string) {
  return ethers.utils.getAddress(address.toLowerCase())
}

describe('Autosweep feature', () => {
  let owner:Wallet
  let holder:Wallet
  let autosweepTarget:Wallet
  let token: TrueUsd
  let registry: RegistryMock

  const expectTransferEventWith = async (tx: Transaction, from: string, to: string, amount: BigNumberish) => expectTransferEventOn(token)(tx, from, to, amount)
  const expectEventsCount = async (eventName: string, tx: ContractTransaction, count: number) => expectEventsCountOn(token)(eventName, tx, count)

  beforeEachWithFixture(async (provider, wallets) => {
    ([owner, holder, autosweepTarget] = wallets)
    ;({ token, registry } = await fixtureWithAave(owner))
    await registry.subscribe(RegistryAttributes.isDepositAddress.hex, token.address)
    await token.mint(holder.address, parseEther('300'))
    const depositAccount = toChecksumAddress('00000' + autosweepTarget.address.slice(2, 37))
    await registry.setAttributeValue(depositAccount, RegistryAttributes.isDepositAddress.hex, autosweepTarget.address)
  })

  context('without truerewards enabled', () => {
    it('sends funds to autosweep address', async () => {
      const recipient = toChecksumAddress(autosweepTarget.address.slice(2, 37) + '00100')
      await token.connect(holder).transfer(recipient, parseEther('1'))
      expect(await token.balanceOf(autosweepTarget.address)).to.eq(parseEther('1'))
      expect(await token.balanceOf(recipient)).to.eq(parseEther('0'))
    })

    it('emits correct events for transfers', async () => {
      const recipient = toChecksumAddress(autosweepTarget.address.slice(2, 37) + '00100')
      const tx = await token.connect(holder).transfer(recipient, parseEther('42'))

      await expectTransferEventWith(tx, recipient, autosweepTarget.address, parseEther('42'))
      await expectTransferEventWith(tx, holder.address, autosweepTarget.address, parseEther('42'))
      await expectEventsCount('Transfer', tx, 2)
      await expectEventsCount('Burn', tx, 0)
      await expectEventsCount('Mint', tx, 0)
    })
  })

  context('with truerewards enabled', () => {

  })
})
