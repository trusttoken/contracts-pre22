import { expect, use } from 'chai'
import { providers, Wallet, ethers } from 'ethers'
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
} from 'contracts'

use(solidity)

describe('GovernorAlpha', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet, thirdAccount: Wallet, fourthAccount: Wallet
  let timelock: Timelock
  let governorAlpha: GovernorAlpha
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider
  let target, values, signatures, callDatas, description
  let votesAmount = 14500000*5

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount, thirdAccount, fourthAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    
    timelock = await deployContract(TimelockFactory,owner.address,2*24*3600) //set delay = 2days 
    trustToken = await deployContract(TrustTokenFactory)
    governorAlpha = await deployContract(GovernorAlphaFactory,timelock.address,trustToken.address,owner.address)

    await trustToken.mint(initialHolder.address,parseTRU(votesAmount)) // 5% of tru
    await trustToken.connect(initialHolder).delegate(initialHolder.address) // delegate itself

    await timelock.connect(owner).setPendingAdmin(governorAlpha.address) // set governorAlpha as the pending admin

    target = [secondAccount.address]
    values = ['0']
    signatures = ['getBalanceOf(address)']
    callDatas = [encodeParameters(['address'],[thirdAccount.address])]
    description = 'test proposal'
  })

  describe('__acceptAdmin', () => {
    it('returns governorAlpha as the new admin', async() => {
      expect(await timelock.admin()).to.eq(owner.address)
      await governorAlpha.connect(owner).__acceptAdmin()
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
      await governorAlpha.connect(owner).__acceptAdmin()
    })
    describe('cancel a proposal', () => {
      it('returns the cancel state of 2', async () => {
        await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
        await governorAlpha.connect(owner).cancel(1) //gudian can cancel a proposal
        expect(await governorAlpha.state(1)).to.eq(2)
      })
    })
  })
  describe('castVote', () => {
    beforeEach(async() => {
      await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
      await provider.send('evm_mine', []) //mine one block
      await governorAlpha.connect(initialHolder).castVote(1,true)
    })
    describe('after initialHolder casts vote', () => {
      it('proposal state becomes active', async() => {
        await provider.send('evm_mine', []) //mine one block
        expect(await governorAlpha.state(1)).to.eq(1)
      })
      it('return the right for votes', async () => {
        expect((await governorAlpha.proposals(1)).forVotes).to.eq(parseTRU(votesAmount))
      })
    })
  })
  // IMPORTANT: Change votingPeriod to 1 (in GovernorAlpha.sol), otherwise it would take too long and cause timeout to run the queue and execute tests

  // describe('queue', () => {
  //   beforeEach(async() => {
  //     await governorAlpha.connect(owner).__acceptAdmin()
  //     await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
  //     await provider.send('evm_mine', []) //mine one block
  //     await governorAlpha.connect(initialHolder).castVote(1,true) //castVote
  //     const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
  //     await skipBlocksWithProvider(provider,endBlockRequired) 
  //   })
  //   describe('when past the voting period', () =>{
  //     it('proposal state becomes succeed', async() => {
  //       expect(await governorAlpha.state(1)).to.eq(4)
  //     })
  //   })
  //   describe('when governorAlpha queue a proposal', () => {
  //     it('returns proposal state equals to queue', async () => {
  //       await governorAlpha.connect(owner).queue(1)
  //       expect(await governorAlpha.state(1)).to.eq(5)
  //     })
  //   })
  // })

  // describe('execute', () => {
  //   beforeEach(async() => {
  //     await governorAlpha.connect(owner).__acceptAdmin()
  //     await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
  //     await provider.send('evm_mine', []) //mine one block
  //     await governorAlpha.connect(initialHolder).castVote(1,true) //castVote
  //     const endBlockRequired = (await governorAlpha.proposals(1)).endBlock.toNumber()
  //     await skipBlocksWithProvider(provider,endBlockRequired) 
  //     await governorAlpha.connect(owner).queue(1) //queue the proposal
  //   })
  //   describe('when governorAlpha execute a proposal', () => {
  //     it('returns proposal state equals to executed', async () => {
  //       await timeTravel(provider,3*24*3600) // delay 3 days
  //       await governorAlpha.connect(owner).execute(1)
  //       expect(await governorAlpha.state(1)).to.eq(7)
  //     })
  //   })
  // })

})

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}
