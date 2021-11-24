import { Timelock, TrustToken, Pauser, Timelock__factory, TrustToken__factory, Pauser__factory, OwnedUpgradeabilityProxy, OwnedProxyWithReference, ImplementationReference, MockPauseableContract, OwnedUpgradeabilityProxy__factory, OwnedProxyWithReference__factory, ImplementationReference__factory, MockPauseableContract__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber, providers, Wallet } from 'ethers'
import { DAY, parseTRU, timeTravel } from 'utils'
import { beforeEachWithFixture } from 'fixtures/beforeEachWithFixture'
import { AddressZero } from '@ethersproject/constants'
import { deployContract } from 'scripts/utils/deployContract'

use(solidity)

describe('Pauser', () => {
  enum RequestState {
    Active, Succeeded, Defeated, Expired, Executed
  }
  enum PausingMethod { Status, Proxy, Reference }

  let owner: Wallet, holder1: Wallet, holder2: Wallet, holder3: Wallet
  let timelock: Timelock
  let trustToken: TrustToken
  let stkTru: TrustToken
  let pauser: Pauser
  let standardProxy: OwnedUpgradeabilityProxy
  let referenceProxy: OwnedProxyWithReference
  let reference: ImplementationReference
  let pauseable: MockPauseableContract
  let provider: providers.JsonRpcProvider
  let governor: OwnedUpgradeabilityProxy

  let target: string[]
  let methods: PausingMethod[]

  const votesAmount = parseTRU(50e6)

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, holder1, holder2, holder3] = wallets
    provider = _provider
    await provider.send('hardhat_reset', [])

    const randomAddress = Wallet.createRandom().address

    timelock = await deployContract(owner, Timelock__factory)
    trustToken = await deployContract(owner, TrustToken__factory)
    stkTru = await deployContract(owner, TrustToken__factory)
    pauser = await deployContract(owner, Pauser__factory)
    standardProxy = await deployContract(owner, OwnedUpgradeabilityProxy__factory)
    reference = await deployContract(owner, ImplementationReference__factory, [randomAddress])
    referenceProxy = await deployContract(owner, OwnedProxyWithReference__factory, [timelock.address, reference.address])
    governor = await deployContract(owner, OwnedUpgradeabilityProxy__factory)
    pauseable = await deployContract(owner, MockPauseableContract__factory)

    await timelock.initialize(owner.address, 200000)
    await trustToken.initialize()
    await stkTru.initialize()
    await pauser.initialize(timelock.address, governor.address, trustToken.address, stkTru.address, DAY)

    await stkTru.mint(holder1.address, votesAmount.div(2))
    await stkTru.connect(holder1).delegate(holder1.address)

    await stkTru.mint(holder2.address, votesAmount.div(2))
    await stkTru.connect(holder2).delegate(holder2.address)

    await trustToken.mint(holder3.address, votesAmount.div(2))
    await trustToken.connect(holder3).delegate(holder3.address)

    await timelock.setPauser(pauser.address)

    await standardProxy.upgradeTo(randomAddress)
    await standardProxy.transferProxyOwnership(timelock.address)
    await reference.transferOwnership(timelock.address)
    const block = await provider.getBlock('latest')
    await timelock.queueTransaction(standardProxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200100)
    await timelock.queueTransaction(reference.address, 0, 'claimOwnership()', '0x', block.timestamp + 200100)
    await timeTravel(standardProxy.provider as any, 200200)
    await timelock.executeTransaction(standardProxy.address, 0, 'claimProxyOwnership()', '0x', block.timestamp + 200100)
    await timelock.executeTransaction(reference.address, 0, 'claimOwnership()', '0x', block.timestamp + 200100)

    target = [standardProxy.address, reference.address, pauseable.address]
    methods = [PausingMethod.Proxy, PausingMethod.Reference, PausingMethod.Status]
  })

  describe('initializer', () => {
    it('sets timelock address', async () => {
      expect(await pauser.timelock()).to.eq(timelock.address)
    })

    it('sets governor address', async () => {
      expect(await pauser.governor()).to.eq(governor.address)
    })

    it('sets trust token address', async () => {
      expect(await pauser.trustToken()).to.eq(trustToken.address)
    })

    it('sets staked tru address', async () => {
      expect(await pauser.stkTRU()).to.eq(stkTru.address)
    })

    it('sets voting period', async () => {
      expect(await pauser.votingPeriod()).to.eq(DAY)
    })
  })

  describe('makeRequest', () => {
    describe('get request ID', () => {
      it('returns id equals to 1', async () => {
        await pauser.connect(holder1).makeRequest(target, methods)
        expect(await pauser.latestRequestIds(holder1.address)).to.eq(1)
      })
    })

    describe('reverts if', () => {
      it('requester does not have enough votes', async () => {
        await expect(pauser.connect(owner).makeRequest([], []))
          .to.be.revertedWith('Pauser::makeRequest: requester votes below request threshold')
      })

      it('targets length does not match methods length', async () => {
        await expect(pauser.connect(holder1).makeRequest([standardProxy.address, referenceProxy.address], [PausingMethod.Proxy]))
          .to.be.revertedWith('Pauser::makeRequest: request function information arity mismatch')

        await expect(pauser.connect(holder1).makeRequest([standardProxy.address], [PausingMethod.Proxy, PausingMethod.Reference]))
          .to.be.revertedWith('Pauser::makeRequest: request function information arity mismatch')
      })

      it('no actions provided', async () => {
        await expect(pauser.connect(holder1).makeRequest([], []))
          .to.be.revertedWith('Pauser::makeRequest: must provide actions')
      })

      it('too many actions provided', async () => {
        await expect(pauser.connect(holder1).makeRequest(Array(11).fill(standardProxy.address), Array(11).fill(PausingMethod.Proxy)))
          .to.be.revertedWith('Pauser::makeRequest: too many actions')
      })
    })

    it('creates request with correct parameters', async () => {
      const tx = await (await pauser.connect(holder1).makeRequest(target, methods)).wait()
      const timestamp = (await provider.getBlock(tx.blockNumber)).timestamp
      const id = await pauser.latestRequestIds(holder1.address)
      const request = await pauser.requests(id)
      expect(request.startBlock).to.equal(tx.blockNumber)
      expect(request.endTime).to.equal(timestamp + DAY)
      expect(request.requester).to.equal(holder1.address)
    })
  })

  describe('castVote', () => {
    beforeEach(async () => {
      await trustToken.mint(owner.address, votesAmount)
      await trustToken.delegate(owner.address)
      await pauser.connect(holder1).makeRequest(target, methods)
      await pauser.connect(holder1).castVote(1)
    })

    describe('after initialHolder casts vote', () => {
      it('request state becomes active', async () => {
        expect(await pauser.state(1)).to.eq(RequestState.Active)
      })

      describe('returns the right number of votes', () => {
        it('single voter', async () => {
          expect((await pauser.requests(1)).votes).to.eq(votesAmount.div(2))
        })

        it('multiple voters', async () => {
          await pauser.castVote(1)
          expect((await pauser.requests(1)).votes).to.eq(votesAmount.mul(3).div(2))
        })
      })

      it('cant vote again', async () => {
        await expect(pauser.connect(holder1).castVote(1))
          .to.be.revertedWith('Pauser::_castVote: voter already voted')
      })

      it('cant vote after voting is over', async () => {
        await timeTravel(provider, DAY)
        await expect(pauser.castVote(1))
          .to.be.revertedWith('Pauser::_castVote: voting is closed')
      })
    })
  })

  describe('execute', () => {
    const newRequestId = 1
    beforeEach(async () => {
      await pauser.connect(holder1).makeRequest(target, methods)
    })

    describe('reverts if', () => {
      it('not enough votes - active', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await expect(pauser.connect(owner).execute(newRequestId))
          .to.be.revertedWith('Pauser::execute: request can only be executed if it is succeeded')
        expect(await pauser.state(newRequestId)).to.eq(RequestState.Active)
      })

      it('not enough votes - not active', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await timeTravel(provider, DAY)
        await expect(pauser.connect(owner).execute(newRequestId))
          .to.be.revertedWith('Pauser::execute: request can only be executed if it is succeeded')
        expect(await pauser.state(newRequestId)).to.eq(RequestState.Defeated)
      })

      it('request expired', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await pauser.connect(holder2).castVote(newRequestId)
        await timeTravel(provider, 2 * DAY)
        await expect(pauser.connect(owner).execute(newRequestId))
          .to.be.revertedWith('Pauser::execute: request can only be executed if it is succeeded')
        expect(await pauser.state(newRequestId)).to.eq(RequestState.Expired)
      })

      it('request already executed', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await pauser.connect(holder2).castVote(newRequestId)
        await pauser.execute(newRequestId)
        await expect(pauser.connect(owner).execute(newRequestId))
          .to.be.revertedWith('Pauser::execute: request can only be executed if it is succeeded')
        expect(await pauser.state(newRequestId)).to.eq(RequestState.Executed)
      })

      it('attempting to pause governor', async () => {
        await pauser.connect(holder2).makeRequest([governor.address], [PausingMethod.Proxy])
        await pauser.connect(holder1).castVote(2)
        await pauser.connect(holder2).castVote(2)
        await expect(pauser.execute(2))
          .to.be.revertedWith('Pauser::execute: cannot pause the governor contract')
      })
    })

    describe('executes', () => {
      it('one vote token used', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await pauser.connect(holder2).castVote(newRequestId)
        await expect(pauser.connect(owner).execute(newRequestId))
          .not.to.be.reverted
      })

      it('mixed vote token used', async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await pauser.connect(holder3).castVote(newRequestId)
        await expect(pauser.connect(owner).execute(newRequestId))
          .not.to.be.reverted
      })
    })

    describe('pauses requested contracts', () => {
      beforeEach(async () => {
        await pauser.connect(holder1).castVote(newRequestId)
        await pauser.connect(holder2).castVote(newRequestId)
        await pauser.execute(newRequestId)
      })

      it('pauses regular proxy', async () => {
        expect(await standardProxy.implementation()).to.eq(AddressZero)
      })

      it('pauses reference proxy', async () => {
        expect(await referenceProxy.implementation()).to.eq(AddressZero)
      })

      it('pauses pausable contract', async () => {
        expect(await pauseable.pauseStatus()).to.eq(true)
      })
    })
  })

  describe('getActions', async () => {
    it('gets no actions from request that doesn\'t exist', async () => {
      const tx = await pauser.getActions(42)
      for (const k in tx) {
        expect(tx[k]).to.eql([])
      }
    })

    it('gets actions from existing proposal', async () => {
      await pauser.connect(holder1).makeRequest(target, methods)
      const tx = await pauser.getActions(1)
      expect(tx[0]).to.eql(target)
      expect(tx[1]).to.eql(methods)
    })
  })

  describe('getReceipt', async () => {
    interface Receipt {
      hasVoted: boolean,
      votes: BigNumber,
    }

    describe('gets default receipt if', async () => {
      it('provided requestId is invalid', async () => {
        const tx = await pauser.getReceipt(42, AddressZero)
        const { hasVoted, votes }: Receipt = tx
        expect(hasVoted).to.be.false
        expect(votes.toNumber()).to.be.eq(0)
      })

      it('provided voter address is invalid', async () => {
        await pauser.connect(holder1).makeRequest(target, methods)
        const tx = await pauser.getReceipt(42, AddressZero)
        const { hasVoted, votes }: Receipt = tx
        expect(hasVoted).to.be.false
        expect(votes.toNumber()).to.be.eq(0)
      })
    })

    describe('gets a receipt when', async () => {
      beforeEach(async () => {
        await trustToken.mint(owner.address, votesAmount.mul(2))
        await trustToken.delegate(owner.address)
        await pauser.connect(holder1).makeRequest(target, methods)
        await timeTravel(provider, 1)
      })

      it('holder votes with TRU', async () => {
        await pauser.connect(holder1).castVote(1)
        const tx = await pauser.getReceipt(1, holder1.address)
        const { hasVoted, votes }: Receipt = tx
        expect(hasVoted).to.be.true
        expect(votes.toNumber()).to.be.eq(votesAmount.div(2))
      })

      it('holder votes with stkTRU', async () => {
        await pauser.connect(holder3).castVote(1)
        const tx = await pauser.getReceipt(1, holder3.address)
        const { hasVoted, votes }: Receipt = tx
        expect(hasVoted).to.be.true
        expect(votes).to.be.eq(votesAmount.div(2))
      })
    })
  })
})
