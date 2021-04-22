import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { beforeEachWithFixture } from 'utils'
import {
  ImplementationReference,
  ImplementationReference__factory, MockTrueCurrency,
  MockTrueCurrency__factory,
} from 'contracts'
import { Wallet } from 'ethers'
import { AddressZero } from '@ethersproject/constants'

use(solidity)

describe('ImplementationReference', () => {
  let owner: Wallet
  let notOwner: Wallet

  let implementationReference: ImplementationReference
  let tusd: MockTrueCurrency

  beforeEachWithFixture(async (wallets) => {
    [owner, notOwner] = wallets
    tusd = await new MockTrueCurrency__factory(owner).deploy()
    implementationReference = await new ImplementationReference__factory(owner).deploy(tusd.address)
  })

  describe('constructor', () => {
    it('sets initial implementation', async () => {
      expect(await implementationReference.implementation())
        .to.eq(tusd.address)
    })

    it('sets initial owner', async () => {
      expect(await implementationReference.owner())
        .to.eq(owner.address)
    })
  })

  describe('ownership', () => {
    it('only owner can transfer ownership', async () => {
      await expect(implementationReference.connect(notOwner).transferOwnership(notOwner.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
      await expect(implementationReference.connect(owner).transferOwnership(notOwner.address))
        .not.to.be.reverted
    })

    it('only pending owner can claim ownership', async () => {
      await expect(implementationReference.connect(owner).claimOwnership())
        .to.be.revertedWith('Ownable: caller is not the pending owner')
      await implementationReference.connect(owner).transferOwnership(notOwner.address)
      await expect(implementationReference.connect(notOwner).claimOwnership())
        .not.to.be.reverted
    })

    it('claims ownership successfully', async () => {
      await implementationReference.connect(owner).transferOwnership(notOwner.address)
      await implementationReference.connect(notOwner).claimOwnership()
      expect(await implementationReference.owner())
        .to.eq(notOwner.address)
      expect(await implementationReference.pendingOwner())
        .to.eq(AddressZero)
    })

    it('emits event on claim', async () => {
      await implementationReference.connect(owner).transferOwnership(notOwner.address)
      await expect(implementationReference.connect(notOwner).claimOwnership())
        .to.emit(implementationReference, 'OwnershipTransferred')
        .withArgs(owner.address, notOwner.address)
    })
  })
})
