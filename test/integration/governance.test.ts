import { TEST_STATE_BLOCK_NUMBER, upgradeSuite } from './suite'
import { GovernorAlpha__factory, StkTruToken__factory } from 'contracts'
import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('Governance', () => {
  it('stkTRU', async () => {
    const emptyAddress = Wallet.createRandom().address
    const holder = '0xfa43e72793535d9059c9b9aa015e3b86e72f4de7'
    const contract = await upgradeSuite(TEST_STATE_BLOCK_NUMBER, StkTruToken__factory, '0x23696914ca9737466d8553a2d619948f548ee424', [
      (contract) => contract.balanceOf(holder),
      (contract) => contract.balanceOf(emptyAddress),
      (contract) => contract.delegates(holder),
      (contract) => contract.checkpoints(holder, 0),
      (contract) => contract.numCheckpoints(holder),
      (contract) => contract.nonces(holder),
      'decimals',
      'name',
      'owner',
      'pendingOwner',
      'rounding',
      'symbol',
      'totalSupply',
      'tru',
      'tfusd',
      'distributor',
      'liquidator',
      'stakeSupply',
      'undistributedTfusdRewards',
      'nextDistributionIndex',
    ])
    expect(await contract.initalized()).to.be.true
    expect(await contract.balanceOf(holder)).to.be.gt(0)
    expect(await contract.numCheckpoints(holder)).to.be.gt(0)
  })

  it('GovernorAlpha', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, GovernorAlpha__factory, '0x0236c16f06aAFdbea5b5EDC8C326A479DB090eB2', [
      // add proposals and latestProposalsIds when they are made on chain
      (contract) => contract.quorumVotes(),
      (contract) => contract.proposalThreshold(),
      (contract) => contract.proposalMaxOperations(),
      (contract) => contract.votingDelay(),
      'votingPeriod',
      'timelock',
      'trustToken',
      'stkTRU',
      'guardian',
      'proposalCount',
    ], '0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521')
  })
})
