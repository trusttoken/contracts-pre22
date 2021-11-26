import { expect } from 'chai'
import { Wallet } from 'ethers'

import {
  Manageable,
  Manageable__factory,
} from 'contracts'
import { describe } from 'mocha'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { AddressZero } from '@ethersproject/constants'

describe('Manageable', () => {
  let manager: Wallet
  let otherWallet: Wallet

  let manageable: Manageable

  beforeEachWithFixture(async (wallets) => {
    [manager, otherWallet] = wallets
    manageable = await new Manageable__factory(manager).deploy()
  })

  describe('constructor', () => {
    it('sets manager as creator', async () => {
      expect(await manageable.manager()).to.equal(manager.address)
    })

    it('initially sets pendingManager to 0', async () => {
      expect(await manageable.pendingManager()).to.equal(AddressZero)
    })

    it('emits event', async () => {
      const anotherManageable = await new Manageable__factory(manager).deploy()
      const creationTx = (anotherManageable).deployTransaction
      await expect(creationTx)
        .to.emit(anotherManageable, 'ManagementTransferred')
        .withArgs(AddressZero, manager.address)
    })
  })

  describe('transferManagement', () => {
    it('reverts when called not by the manager', async () => {
      await expect(manageable.connect(otherWallet).transferManagement(otherWallet.address))
        .to.be.revertedWith('Manageable: Caller is not the manager')
    })

    it('sets pendingManager', async () => {
      await manageable.connect(manager).transferManagement(otherWallet.address)
      expect(await manageable.pendingManager()).to.equal(otherWallet.address)
    })
  })

  describe('claimManagement', () => {
    beforeEach(async () => {
      await manageable.connect(manager).transferManagement(otherWallet.address)
    })

    it('reverts when called not by the pending manager', async () => {
      await expect(manageable.connect(manager).claimManagement())
        .to.be.revertedWith('Manageable: Caller is not the pending manager')
    })

    it('sets new manager', async () => {
      await manageable.connect(otherWallet).claimManagement()
      expect(await manageable.manager()).to.equal(otherWallet.address)
    })

    it('sets pending manager to 0', async () => {
      await manageable.connect(otherWallet).claimManagement()
      expect(await manageable.pendingManager()).to.equal(AddressZero)
    })
  })
})
