import { Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { trueCurrency } from 'fixtures/trueCurrency'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueCurrency } from 'contracts/types/TrueCurrency'

describe('TrueCurrency - Ownable', () => {
  let owner: Wallet
  let newOwner: Wallet
  let other: Wallet
  let token: TrueCurrency

  function transferOwnership (caller: Wallet, newOwner: WalletOrAddress) {
    return token.connect(caller).transferOwnership(toAddress(newOwner))
  }

  function claimOwnership (caller: Wallet) {
    return token.connect(caller).claimOwnership()
  }

  beforeEach(async () => {
    ({ wallets: [owner, newOwner, other], token } = await loadFixture(trueCurrency))
  })

  it('should have an owner', async () => {
    expect(await token.owner()).to.eq(owner.address)
  })

  describe('when transfer of ownership', () => {
    it('does not change owner', async () => {
      await transferOwnership(owner, newOwner)
      expect(await token.owner()).to.eq(owner.address)
    })

    it('changes pending owner', async () => {
      await transferOwnership(owner, newOwner)
      expect(await token.pendingOwner()).to.eq(newOwner.address)
    })

    it('does not emit events', async () => {
      await expect(transferOwnership(owner, newOwner)).to.not.emit(token, 'OwnershipTransferred')
    })

    it('should prevent non-owners from transferring', async () => {
      await expect(transferOwnership(newOwner, Wallet.createRandom()))
        .to.be.revertedWith('only Owner')
    })
  })

  describe('when ownership is claimed', () => {
    beforeEach(async () => {
      await transferOwnership(owner, newOwner)
    })

    it('changes owner', async () => {
      await claimOwnership(newOwner)
      expect(await token.owner()).to.eq(newOwner.address)
    })

    it('emits OwnershipTransferred event', async () => {
      await expect(claimOwnership(newOwner))
        .to.emit(token, 'OwnershipTransferred')
        .withArgs(owner.address, newOwner.address)
    })

    it('can be called only by pending owner', async () => {
      await expect(claimOwnership(other)).to.be.revertedWith('only pending owner')
    })
  })
})
