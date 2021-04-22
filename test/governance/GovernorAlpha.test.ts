import { expect, use } from 'chai'
import { BigNumber, ContractTransaction, providers, utils, Wallet } from 'ethers'
import { beforeEachWithFixture, parseTRU, skipBlocksWithProvider, timeTravel } from 'utils'
import { AddressZero } from '@ethersproject/constants'
import { solidity } from 'ethereum-waffle'

import {
  GovernorAlpha,
  GovernorAlpha__factory,
  Timelock,
  Timelock__factory,
  TrustToken,
  TrustToken__factory,
} from 'contracts'

use(solidity)

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed
}

describe('GovernorAlpha', () => {
  let owner: Wallet, initialHolder: Wallet
  let timelock: Timelock
  let governorAlpha: GovernorAlpha
  let trustToken: TrustToken
  let stkTru: TrustToken
  let provider: providers.JsonRpcProvider
  const votesAmount = parseTRU(10000000) // 10m of TRU
  let target: string[]
  let values: string[]
  let signatures: string[]
  let callDatas: string[]
  let description: string

  const endVote = async () => {
    await skipBlocksWithProvider(provider, 7)
  }

  const getLockedTxId = async (tx: ContractTransaction) => {
    const res = await tx.wait()
    return res.logs[0].topics[1]
  }

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, initialHolder] = wallets)
    provider = _provider

    timelock = await new Timelock__factory(owner).deploy()
    await timelock.connect(owner).initialize(owner.address, 2 * 24 * 3600)

    trustToken = await new TrustToken__factory(owner).deploy()
    await trustToken.connect(owner).initialize()

    stkTru = await new TrustToken__factory(owner).deploy()
    await stkTru.connect(owner).initialize()

    governorAlpha = await new GovernorAlpha__factory(owner).deploy()
    await governorAlpha.connect(owner).initialize(timelock.address, trustToken.address, owner.address, stkTru.address, 5) // votingPeriod = 1 blocks

    // mint votesAmount/2 of tru
    await trustToken.mint(initialHolder.address, votesAmount.div(2))
    // delegate all votes to itself
    await trustToken.connect(initialHolder).delegate(initialHolder.address)
    // mint votesAmount/2 of tru
    await stkTru.mint(initialHolder.address, votesAmount.div(2))
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

  describe('propose', () => {
    describe('get proposal ID', () => {
      it('returns id equals to 1', async () => {
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
      })
    })

    describe('Reverts if', () => {
      it('proposer has less votes than target', async () => {
        await trustToken.connect(initialHolder).burn(parseTRU(5_000_000))
        await stkTru.connect(initialHolder).burn(parseTRU(5_000_000))
        await expect(governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: proposer votes below proposal threshold')
      })

      it('array arities mismatch', async () => {
        await expect(governorAlpha.connect(initialHolder).propose([target[0], target[0]], values, signatures, callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')
        await expect(governorAlpha.connect(initialHolder).propose(target, [...values, 0], signatures, callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')
        await expect(governorAlpha.connect(initialHolder).propose(target, values, [...signatures, ''], callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')
        await expect(governorAlpha.connect(initialHolder).propose(target, values, signatures, [callDatas[0], callDatas[0]], description))
          .to.be.revertedWith('GovernorAlpha::propose: proposal function information arity mismatch')
      })

      it('nothing is proposed', async () => {
        await expect(governorAlpha.connect(initialHolder).propose([], [], [], [], description))
          .to.be.revertedWith('GovernorAlpha::propose: must provide actions')
      })

      it('too many operations', async () => {
        await expect(governorAlpha.connect(initialHolder).propose(Array(11).fill(target[0]), Array(11).fill(values[0]), Array(11).fill(signatures[0]), Array(11).fill(callDatas[0]), description))
          .to.be.revertedWith('GovernorAlpha::propose: too many actions')
      })

      it('proposer has pending proposal', async () => {
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        await expect(governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal')
      })

      it('proposer has active proposal', async () => {
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        await timeTravel(provider, 1)
        await expect(governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description))
          .to.be.revertedWith('GovernorAlpha::propose: one live proposal per proposer, found an already active proposal')
      })
    })

    it('creates proposal with correct parameters', async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      const id = await governorAlpha.latestProposalIds(initialHolder.address)
      const proposal = await governorAlpha.proposals(id)
      const bn = await provider.getBlockNumber()
      expect(proposal.startBlock).to.equal(bn + 1)
      expect(proposal.endBlock).to.equal(bn + 6)
      expect(proposal.proposer).to.equal(initialHolder.address)
    })
  })

  describe('queue', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
    })

    describe('Reverts if', () => {
      it('state is pending', async () => {
        expect(await governorAlpha.state(1)).to.equal(ProposalState.Pending)
        await expect(governorAlpha.connect(owner).queue(1)).to.be.revertedWith('GovernorAlpha::queue: proposal can only be queued if it is succeeded')
      })

      it('state is active', async () => {
        await timeTravel(provider, 1)
        await timeTravel(provider, 1)
        expect(await governorAlpha.state(1)).to.equal(ProposalState.Active)
        await expect(governorAlpha.connect(owner).queue(1)).to.be.revertedWith('GovernorAlpha::queue: proposal can only be queued if it is succeeded')
      })

      it('state is defeated', async () => {
        await endVote()
        expect(await governorAlpha.state(1)).to.equal(ProposalState.Defeated)
        await expect(governorAlpha.connect(owner).queue(1)).to.be.revertedWith('GovernorAlpha::queue: proposal can only be queued if it is succeeded')
      })
    })

    describe('Succeeds', () => {
      let tx: ContractTransaction
      beforeEach(async () => {
        await timeTravel(provider, 1) // mine one block
        await governorAlpha.connect(initialHolder).castVote(1, true) // castVote
        const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
        await skipBlocksWithProvider(provider, endBlockRequired)
        expect(await governorAlpha.state(1)).to.eq(ProposalState.Succeeded)
        tx = await governorAlpha.connect(owner).queue(1)
      })

      it('proposal state becomes queued', async () => {
        expect(await governorAlpha.state(1)).to.eq(ProposalState.Queued)
      })

      it('queues all calls to timelock', async () => {
        const txId = await getLockedTxId(tx)
        const eta = (await governorAlpha.proposals(1)).eta
        await expect(Promise.resolve(tx)).to.emit(timelock, 'QueueTransaction').withArgs(
          txId,
          target[0],
          values[0],
          signatures[0],
          callDatas[0],
          eta,
        )
      })
    })
  })

  describe('execute', () => {
    const newProposalId = 1
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1) // mine one block
      await governorAlpha.connect(initialHolder).castVote(1, true) // castVote
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider, endBlockRequired)
    })

    it('cannot execute not queued proposal', async () => {
      await expect(governorAlpha.connect(owner).execute(newProposalId)).to.be.revertedWith('GovernorAlpha::execute: proposal can only be executed if it is queued')
    })

    it('cannot execute proposal before it is unlocked', async () => {
      await governorAlpha.connect(owner).queue(newProposalId)
      await expect(governorAlpha.connect(owner).execute(newProposalId)).to.be.revertedWith('Timelock::executeTransaction: Transaction hasn\'t surpassed time lock.')
    })

    describe('when governorAlpha executes a proposal', () => {
      let tx: ContractTransaction

      beforeEach(async () => {
        await governorAlpha.connect(owner).queue(newProposalId) // queue the proposal
        await timeTravel(provider, 3 * 24 * 3600) // delay 3 days
        expect(await timelock.pendingAdmin()).to.eq('0x0000000000000000000000000000000000000000')
        tx = await governorAlpha.connect(owner).execute(newProposalId) // execute
      })

      it('returns proposal state equals to executed', async () => {
        expect(await governorAlpha.state(1)).to.eq(ProposalState.Executed)
      })

      it('transaction takes effect (changes pending admin in this case)', async () => {
        expect(await timelock.pendingAdmin()).to.eq(initialHolder.address)
      })

      it('emits event', async () => {
        await expect(Promise.resolve(tx)).to.emit(governorAlpha, 'ProposalExecuted').withArgs(newProposalId)
      })
    })
  })

  describe('cancel', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
    })

    it('sets state to Canceled', async () => {
      expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
      await governorAlpha.connect(owner).cancel(1)
      expect(await governorAlpha.state(1)).to.eq(ProposalState.Canceled)
    })

    it('only guardian can cancel the proposal', async () => {
      await expect(governorAlpha.connect(initialHolder).cancel(1)).to.be.revertedWith('GovernorAlpha::cancel: proposer above threshold')
    })

    it('if proposer does not hold TRU, anyone can cancel it', async () => {
      await trustToken.connect(initialHolder).burn(parseTRU(5_000_000))
      await stkTru.connect(initialHolder).burn(parseTRU(5_000_000))
      await governorAlpha.connect(initialHolder).cancel(1)
      expect(await governorAlpha.state(1)).to.eq(ProposalState.Canceled)
    })

    it('cancelled timelocked actions if proposal was queued', async () => {
      await timeTravel(provider, 1)
      await governorAlpha.connect(initialHolder).castVote(1, true)
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider, endBlockRequired)
      expect(await governorAlpha.state(1)).to.eq(ProposalState.Succeeded)
      const tx = await governorAlpha.connect(owner).queue(1)
      const id = await getLockedTxId(tx)
      const eta = (await governorAlpha.proposals(1)).eta
      await expect(governorAlpha.connect(owner).cancel(1)).to.emit(timelock, 'CancelTransaction').withArgs(
        id,
        target[0],
        values[0],
        signatures[0],
        callDatas[0],
        eta,
      )
    })

    it('cannot cancel executed proposal', async () => {
      await timeTravel(provider, 1)
      await governorAlpha.connect(initialHolder).castVote(1, true)
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider, endBlockRequired)
      await governorAlpha.connect(owner).queue(1)
      await timeTravel(provider, 3 * 24 * 3600)
      await governorAlpha.connect(owner).execute(1)
      await expect(governorAlpha.connect(owner).cancel(1)).to.be.revertedWith('GovernorAlpha::cancel: cannot cancel executed proposal')
    })
  })

  describe('getActions', async () => {
    it('gets no actions from proposal that doesn\'t exist', async () => {
      const tx = await governorAlpha.getActions(42)
      for (const k in tx) {
        expect(tx[k]).to.eql([])
      }
    })

    it('gets actions from existing proposal', async () => {
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      const tx = await governorAlpha.getActions(1)
      expect(tx[0]).to.eql(target)
      expect(tx[1].map(bigNum => bigNum.toString())).to.eql(values)
      expect(tx[2]).to.eql(signatures)
      expect(tx[3]).to.eql(callDatas)
    })
  })

  describe('getReceipt', async () => {
    interface Receipt {
      hasVoted: boolean,
      support: boolean,
      votes: BigNumber,
    }

    describe('gets default receipt if', async () => {
      it('provided proposalId is invalid', async () => {
        const tx = await governorAlpha.getReceipt(42, AddressZero)
        const { hasVoted, support, votes }: Receipt = tx
        expect(hasVoted).to.be.false
        expect(support).to.be.false
        expect(votes.toNumber()).to.be.eq(0)
      })

      it('provided voter address is invalid', async () => {
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        const tx = await governorAlpha.getReceipt(42, AddressZero)
        const { hasVoted, support, votes }: Receipt = tx
        expect(hasVoted).to.be.false
        expect(support).to.be.false
        expect(votes.toNumber()).to.be.eq(0)
      })
    })

    describe('gets a receipt when', async () => {
      beforeEach(async () => {
        await trustToken.mint(owner.address, votesAmount.mul(2))
        await trustToken.delegate(owner.address)
        await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
        await timeTravel(provider, 1)
      })

      it('initialHolder voted for', async () => {
        await governorAlpha.connect(initialHolder).castVote(1, true)
        const tx = await governorAlpha.getReceipt(1, initialHolder.address)
        const { hasVoted, support, votes }: Receipt = tx
        expect(hasVoted).to.be.true
        expect(support).to.be.true
        expect(votes.toNumber()).to.be.eq(votesAmount)
      })

      it('initialHolder voted against', async () => {
        await governorAlpha.connect(initialHolder).castVote(1, false)
        const tx = await governorAlpha.getReceipt(1, initialHolder.address)
        const { hasVoted, support, votes }: Receipt = tx
        expect(hasVoted).to.be.true
        expect(support).to.be.false
        expect(votes).to.be.eq(votesAmount)
      })
    })
  })

  describe('castVote', () => {
    beforeEach(async () => {
      await trustToken.mint(owner.address, votesAmount.mul(2))
      await trustToken.delegate(owner.address)
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1)
      await governorAlpha.connect(initialHolder).castVote(1, true)
    })

    describe('after initialHolder casts vote', () => {
      it('proposal state becomes active', async () => {
        expect(await governorAlpha.state(1)).to.eq(ProposalState.Active)
      })

      it('return the right for votes', async () => {
        expect((await governorAlpha.proposals(1)).forVotes).to.eq(votesAmount)
      })

      it('cant vote again', async () => {
        await expect(governorAlpha.connect(initialHolder).castVote(1, false)).to.be.revertedWith('GovernorAlpha::_castVote: voter already voted')
      })

      it('cant vote after voting is over', async () => {
        await endVote()
        await expect(governorAlpha.castVote(1, true)).to.be.revertedWith('GovernorAlpha::_castVote: voting is closed')
      })

      it('casting a lot of against votes defeats proposal', async () => {
        await governorAlpha.castVote(1, false)
        await endVote()
        expect(await governorAlpha.state(1)).to.equal(ProposalState.Defeated)
      })
    })
  })

  describe('castVoteBySig', () => {
    async function sign (wallet: Wallet, proposalId: number, support: boolean, governor: string) {
      const domain = {
        name: 'TrueFi Governance',
        chainId: (await wallet.provider.getNetwork()).chainId,
        verifyingContract: governor,
      }
      const types = {
        Ballot: [
          { name: 'proposalId', type: 'uint256' },
          { name: 'support', type: 'bool' },
        ],
      }
      const value = {
        proposalId,
        support,
      }
      return wallet._signTypedData(domain, types, value)
    }

    async function castVoteBySig (signer: Wallet, proposalId: number, support: boolean, governor = governorAlpha.address) {
      const signature = await sign(signer, proposalId, support, governor)
      const { v, r, s } = utils.splitSignature(signature)

      return governorAlpha.castVoteBySig(proposalId, support, v, r, s)
    }

    beforeEach(async () => {
      await trustToken.mint(owner.address, votesAmount.mul(2))
      await trustToken.delegate(owner.address)
      await governorAlpha.connect(initialHolder).propose(target, values, signatures, callDatas, description)
      await timeTravel(provider, 1)
      await castVoteBySig(initialHolder, 1, true)
    })

    describe('after initialHolder casts vote', () => {
      it('proposal state becomes active', async () => {
        expect(await governorAlpha.state(1)).to.eq(ProposalState.Active)
      })

      it('return the right for votes', async () => {
        expect((await governorAlpha.proposals(1)).forVotes).to.eq(votesAmount)
      })

      it('cant vote again', async () => {
        await expect(castVoteBySig(initialHolder, 1, false)).to.be.revertedWith('GovernorAlpha::_castVote: voter already voted')
      })

      it('cant vote after voting is over', async () => {
        await endVote()
        await expect(castVoteBySig(owner, 1, true)).to.be.revertedWith('GovernorAlpha::_castVote: voting is closed')
      })

      it('casting a lot of against votes defeats proposal', async () => {
        await castVoteBySig(owner, 1, false)
        await endVote()
        expect(await governorAlpha.state(1)).to.equal(ProposalState.Defeated)
      })
    })
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

  describe('SetTimelockPendingAdmin', () => {
    it('guardian can change timelock pending admin', async () => {
      const { timestamp } = await provider.getBlock('latest')
      const eta = (await timelock.delay()).add(timestamp).add(100)
      await governorAlpha.__queueSetTimelockPendingAdmin(initialHolder.address, eta)
      await timeTravel(provider, 3 * 24 * 3600)
      await governorAlpha.__executeSetTimelockPendingAdmin(initialHolder.address, eta)
      expect(await timelock.pendingAdmin()).to.eq(initialHolder.address)
    })

    describe('revert if not called by guardian in', async () => {
      it('__queue', async () => {
        const { timestamp } = await provider.getBlock('latest')
        const eta = (await timelock.delay()).add(timestamp).add(100)
        await expect(governorAlpha.connect(initialHolder).__queueSetTimelockPendingAdmin(initialHolder.address, eta))
          .to.be.revertedWith('GovernorAlpha::__queueSetTimelockPendingAdmin: sender must be gov guardian')
      })

      it('__execute', async () => {
        const { timestamp } = await provider.getBlock('latest')
        const eta = (await timelock.delay()).add(timestamp).add(100)
        await governorAlpha.__queueSetTimelockPendingAdmin(initialHolder.address, eta)
        await timeTravel(provider, 3 * 24 * 3600)
        await expect(governorAlpha.connect(initialHolder).__executeSetTimelockPendingAdmin(initialHolder.address, eta))
          .to.be.revertedWith('GovernorAlpha::__executeSetTimelockPendingAdmin: sender must be gov guardian')
      })
    })
  })
})
