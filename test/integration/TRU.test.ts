import { upgradeSuite } from './suite'
import {
  TrustTokenFactory,
} from 'contracts'
import { expect } from 'chai'
import { Wallet } from 'ethers'

const addressWithLockedFunds = '0xf10b99017a1e5d26b05fa91d923c150e701b05a8'
const addressWithoutLockedFunds = '0xf0db95a3c4791eff8b934da8d7ea495632f05d9d'

describe('Upgrade', () => {
  it('TRU storage', async () => {
    const emptyAddress = Wallet.createRandom().address

    const contract = await upgradeSuite(TrustTokenFactory, '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784', [
      (contract) => contract.balanceOf(addressWithLockedFunds),
      (contract) => contract.balanceOf(addressWithoutLockedFunds),
      (contract) => contract.balanceOf(emptyAddress),
      (contract) => contract.unlockedBalance(addressWithLockedFunds),
      (contract) => contract.unlockedBalance(addressWithoutLockedFunds),
      (contract) => contract.unlockedBalance(emptyAddress),
      (contract) => contract.lockedBalance(addressWithLockedFunds),
      (contract) => contract.lockedBalance(addressWithoutLockedFunds),
      (contract) => contract.lockedBalance(emptyAddress),
      'decimals',
      'epochsLeft',
      'epochsPassed',
      'finalEpoch',
      'lockStart',
      'name',
      'owner',
      'pendingOwner',
      'returnsLocked',
      'rounding',
      'symbol',
      'timeLockRegistry',
      'totalSupply',
    ])
    expect(await contract.balanceOf(addressWithLockedFunds)).to.be.gt(0)
    expect(await contract.balanceOf(addressWithoutLockedFunds)).to.be.gt(0)
    expect(await contract.lockedBalance(addressWithLockedFunds)).to.be.gt(0)
    expect(await contract.lockedBalance(addressWithoutLockedFunds)).to.equal(0)
    expect(await contract.unlockedBalance(addressWithLockedFunds)).to.be.gt(0)
    expect(await contract.unlockedBalance(addressWithoutLockedFunds)).to.be.gt(0)
  })
})
