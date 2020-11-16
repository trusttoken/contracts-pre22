import { constants, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { setupTrueGold } from 'fixtures/trueGold'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueGold } from 'contracts'

describe('TrueGold - Ownable', () => {
  let owner: Wallet
  let other: Wallet
  let token: TrueGold

  function transferOwnership (caller: Wallet, newOwner: WalletOrAddress) {
    return token.connect(caller).transferOwnership(toAddress(newOwner))
  }

  beforeEach(async () => {
    ({ deployer: owner, initialHolder: other, token } = await loadFixture(setupTrueGold))
  })

  it('should have an owner', async () => {
    expect(await token.owner()).to.eq(owner.address)
  })

  it('changes owner after transfer', async () => {
    await expect(transferOwnership(owner, other))
      .to.emit(token, 'OwnershipTransferred')
      .withArgs(owner.address, other.address)

    expect(await token.owner()).to.eq(other.address)
  })

  it('should prevent non-owners from transferring', async () => {
    await expect(transferOwnership(other, Wallet.createRandom()))
      .to.be.revertedWith('Ownable: caller is not the owner')
  })

  it('should guard ownership against stuck state', async () => {
    await expect(transferOwnership(owner, constants.AddressZero))
      .to.be.revertedWith('Ownable: new owner is the zero address')
  })
})
