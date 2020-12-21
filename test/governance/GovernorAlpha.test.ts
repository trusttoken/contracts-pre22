import { expect, use } from 'chai'
import { providers, Wallet, ethers, utils } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  parseTRU,
  skipBlocksWithProvider,
  timeTravel
} from 'utils'

import {
  TrustTokenFactory,
  TrustToken,
  TimelockFactory,
  Timelock,
  GovernorAlphaFactory,
  GovernorAlpha,
  OwnedUpgradeabilityProxyFactory,
  OwnedUpgradeabilityProxy
} from 'contracts'

use(solidity)

describe('GovernorAlpha', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet, thirdAccount: Wallet, fourthAccount: Wallet
  let timelock: Timelock
  let governorAlpha: GovernorAlpha
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider
  let tokenProxy: OwnedUpgradeabilityProxy
  let target, values, signatures, callDatas, description
  let votesAmount = 14500000*5 // 5% of TRU

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount, thirdAccount, fourthAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    
    //deploy timelock and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new TimelockFactory(owner).deploy()).address)
    timelock = new TimelockFactory(owner).attach(tokenProxy.address)
    await timelock.connect(owner).initialize(owner.address,2*24*3600)

    //deploy tursttoken and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new TrustTokenFactory(owner).deploy()).address)
    trustToken = new TrustTokenFactory(owner).attach(tokenProxy.address)
    await trustToken.connect(owner).initialize()

    //deploy governorAlpha and proxy contract
    tokenProxy = await new OwnedUpgradeabilityProxyFactory(owner).deploy()
    await tokenProxy.upgradeTo((await new GovernorAlphaFactory(owner).deploy()).address)
    governorAlpha = new GovernorAlphaFactory(owner).attach(tokenProxy.address)
    await governorAlpha.connect(owner).initialize(timelock.address,trustToken.address,owner.address,1) //votingPeriod = 1 blocks

    // mint votesAmount(5%) of tru
    await trustToken.mint(initialHolder.address,parseTRU(votesAmount)) 
    // delegate all votes to itself
    await trustToken.connect(initialHolder).delegate(initialHolder.address) 
    // set governorAlpha as the pending admin
    await timelock.connect(owner).setPendingAdmin(governorAlpha.address) 
    // set governorAlpha as the new admin
    await governorAlpha.connect(owner).__acceptAdmin()

    // assign values to a test proposal 
    target = [timelock.address]
    values = ['0']
    signatures = ['setPendingAdmin(address)']
    callDatas = [(new utils.AbiCoder()).encode(['address'],[initialHolder.address])]
    description = 'this proposal set a new pending admin'
  })

  describe('__acceptAdmin', () => {
    it('returns governorAlpha as the new admin', async() => {      
      expect(await timelock.admin()).to.eq(governorAlpha.address)
    })
  })

  describe('__abdicate', () => {
    it('guardian should be address(0)', async() => {
      await governorAlpha.connect(owner).__abdicate()
      expect(await governorAlpha.guardian()).to.eq('0x0000000000000000000000000000000000000000')
    })
  })

  describe('propose', () => {
    describe('get proposal ID', () => {
      it('returns id equals to 1', async () => {
        await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
      })
    })
  })

  describe('cancel', () => {
    beforeEach(async () => {
      await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
    })
    describe('cancel a proposal', () => {
      it('returns the cancel state of 2', async () => {
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
        await governorAlpha.connect(owner).cancel(1) //gudian can cancel a proposal
        expect(await governorAlpha.state(1)).to.eq(2)
      })
    })
  })
  describe('castVote', () => {
    beforeEach(async() => {
      await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
      await timeTravel(provider,1)
      await governorAlpha.connect(initialHolder).castVote(1,true)
    })
    describe('after initialHolder casts vote', () => {
      it('proposal state becomes active', async() => {
        expect(await governorAlpha.state(1)).to.eq(1)
      })
      it('return the right for votes', async () => {
        expect((await governorAlpha.proposals(1)).forVotes).to.eq(parseTRU(votesAmount))
      })
    })
  })

  describe('queue', () => {
    beforeEach(async() => {
      await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
      await timeTravel(provider,1) //mine one block
      await governorAlpha.connect(initialHolder).castVote(1,true) //castVote
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider,endBlockRequired) 
    })
    describe('when past the voting period', () =>{
      it('proposal state becomes succeed', async() => {
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
    beforeEach(async() => {
      await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
      await timeTravel(provider,1) //mine one block
      await governorAlpha.connect(initialHolder).castVote(1,true) //castVote
      const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
      await skipBlocksWithProvider(provider,endBlockRequired) 
      await governorAlpha.connect(owner).queue(1) //queue the proposal
      await timeTravel(provider,3*24*3600) // delay 3 days
      expect(await timelock.pendingAdmin()).to.eq('0x0000000000000000000000000000000000000000')
      await governorAlpha.connect(owner).execute(1) //execute
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

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}
