import { TEST_STATE_BLOCK_NUMBER, upgradeSuite } from './suite'
import {
  TrustToken__factory,
} from 'contracts'
import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

use(solidity)

const addressWithLockedFunds = '0xf10b99017a1e5d26b05fa91d923c150e701b05a8'
const addressWithoutLockedFunds = '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be'

it('TRU', async () => {
  const emptyAddress = Wallet.createRandom().address

  const contract = await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrustToken__factory, '0x4c19596f5aaff459fa38b0f7ed92f11ae6543784', [
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
