import { expect, use } from 'chai'
import { providers, utils, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { beforeEachWithFixture, parseTRU, skipBlocksWithProvider, timeTravel } from 'utils'

import {
  GovernorAlpha,
  GovernorAlphaFactory,
  OwnedUpgradeabilityProxy,
  OwnedUpgradeabilityProxyFactory,
  Timelock,
  TimelockFactory,
  TrustToken,
  TrustTokenFactory,
} from 'contracts'

use(solidity)

describe('GovernorAlpha', () => {
  let owner: Wallet, initialHolder: Wallet
  let timelock: Timelock
  let governorAlpha: GovernorAlpha
  let trustToken: TrustToken
  let stkTru: TrustToken
  let provider: providers.JsonRpcProvider
  let tokenProxy: OwnedUpgradeabilityProxy
  let target, values, signatures, callDatas, description
  const votesAmount = 10000000 // 10m of TRU

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, initialHolder] = wallets)
    provider = _provider

    // deploy timelock and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new TimelockFactory(owner).deploy()).address)
    timelock = new TimelockFactory(owner).attach(tokenProxy.address)
    await timelock.connect(owner).initialize(owner.address, 2 * 24 * 3600)

    // deploy tursttoken and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new TrustTokenFactory(owner).deploy()).address)
    trustToken = new TrustTokenFactory(owner).attach(tokenProxy.address)
    await trustToken.connect(owner).initialize()

    // deploy mockTru and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new TrustTokenFactory(owner).deploy()).address)
    stkTru = new TrustTokenFactory(owner).attach(tokenProxy.address)
    await stkTru.connect(owner).initialize()

    // deploy governorAlpha and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new GovernorAlphaFactory(owner).deploy()).address)
    governorAlpha = new GovernorAlphaFactory(owner).attach(tokenProxy.address)
    await governorAlpha.connect(owner).initialize(timelock.address, trustToken.address, owner.address, stkTru.address, 1) // votingPeriod = 1 blocks

    // mint votesAmount/2 of tru
    await trustToken.mint(initialHolder.address, parseTRU(votesAmount / 2))
    // delegate all votes to itself
    await trustToken.connect(initialHolder).delegate(initialHolder.address)
    // mint votesAmount/2 of tru
    await stkTru.mint(initialHolder.address, parseTRU(votesAmount / 2))
    // delegate all votes to itself
    await stkTru.connect(initialHolder).delegate(initialHolder.address)

    // set governorAlpha as the pending admin
    await timelock.connect(owner).setPendingAdmin(governorAlpha.address)
    // set governorAlpha as the new admin
    await governorAlpha.connect(owner).__acceptAdmin()

    // assign values to a test proposal
    target = [timelock.address]
    values = ['0']
    signatures = ['setPendingAdmin(address)']
    callDatas = [(new utils.AbiCoder()).encode(['address'], [initialHolder.address])]
    description = 'this proposal set a new pending admin'
  })

  describe('__acceptAdmin', () => {
    it('returns governorAlpha as the new admin', async () => {
      expect(await timelock.admin()).to.eq(governorAlpha.address)
    })
  })

  describe('__abdicate', () => {
    it('guardian should be address(0)', async () => {
      await governorAlpha.connect(owner).__abdicate()
      expect(await governorAlpha.guardian()).to.eq('0x0000000000000000000000000000000000000000')
    })
  })

  describe('propose', () => {
    describe('get proposal ID', () => {
      it('returns id equals to 1', async () => {
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
      })
    })
  })

  describe('cancel', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
    })
    describe('cancel a proposal', () => {
      it('returns the cancel state of 2', async () => {
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
        await governorAlpha.connect(owner).cancel(1) // gudian can cancel a proposal
        expect(await governorAlpha.state(1)).to.eq(2)
      })
    })
  })
  describe('castVote', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1)
      await governorAlpha.connect(initialHolder).castVote(1, true)
    })
    describe('after initialHolder casts vote', () => {
      it('proposal state becomes active', async () => {
        expect(await governorAlpha.state(1)).to.eq(1)
      })
      it('return the right for votes', async () => {
        expect((await governorAlpha.proposals(1)).forVotes).to.eq(parseTRU(votesAmount))
      })
    })
  })

  describe('queue', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1) // mine one block
      await governorAlpha.connect(initialHolder).castVote(1, true) // castVote
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider, endBlockRequired)
    })
    describe('when past the voting period', () => {
      it('proposal state becomes succeed', async () => {
        expect(await governorAlpha.state(1)).to.eq(4)
      })
    })
    describe('when governorAlpha queue a proposal', () => {
      it('returns proposal state equals to queue', async () => {
        await governorAlpha.connect(owner).queue(1)
        expect(await governorAlpha.state(1)).to.eq(5)
      })
    })
  })

  describe('execute', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1) // mine one block
      await governorAlpha.connect(initialHolder).castVote(1, true) // castVote
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider, endBlockRequired)
      await governorAlpha.connect(owner).queue(1) // queue the proposal
      await timeTravel(provider, 3 * 24 * 3600) // delay 3 days
      expect(await timelock.pendingAdmin()).to.eq('0x0000000000000000000000000000000000000000')
      await governorAlpha.connect(owner).execute(1) // execute
    })
    describe('when governorAlpha execute a proposal', () => {
      it('returns proposal state equals to executed', async () => {
        expect(await governorAlpha.state(1)).to.eq(7)
      })
      it('returns initialHolder as the new pendingAdmin', async () => {
        expect(await timelock.pendingAdmin()).to.eq(initialHolder.address)
      })
    })
  })
})
