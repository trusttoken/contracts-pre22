import { upgradeSuite } from './suite'
import { StkTruTokenFactory } from 'contracts'
import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

use(solidity)

const holder = '0xfa43e72793535d9059c9b9aa015e3b86e72f4de7'

it('stkTRU', async () => {
  const emptyAddress = Wallet.createRandom().address

  const contract = await upgradeSuite(StkTruTokenFactory, '0x23696914ca9737466d8553a2d619948f548ee424', [
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
