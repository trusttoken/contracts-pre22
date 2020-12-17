import { expect, use } from 'chai'
import { providers, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  parseTRU,
} from 'utils'

import {
  TrustTokenFactory,
  TrustToken,
} from 'contracts'

use(solidity)

describe('VoteToken', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet, thirdAccount: Wallet, fourthAccount: Wallet
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount, thirdAccount, fourthAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.initialize()
    await trustToken.mint(initialHolder.address, parseTRU(1000))
  })

  describe('unlockedBalance', () => {
    describe('initialHolder unlocked balance', () => {
      it('returns 1000', async () => {
        expect(await trustToken.unlockedBalance(initialHolder.address)).to.eq(parseTRU(1000))
      })
    })
  })

  describe('getCurrentVotes', () => {
    describe('when all TRU are unlocked', () => {
      it('return 0 vote for initialHolder without delegate', async () => {
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))        
      })
    })
    describe('when TRU token is partially locked', () =>{
      it('return only unlocked votes', async() => {
        //TODO
      })
    })

  })

  describe('delegate', () => {
    describe('delegate to itself', () => {
      it('return 1000 vote', async () => {
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(1000))        
      })
    })

    describe('delegate to other account', () => {
      it('return 0 vote for initial account and 1000 for second account', async () => {
        await trustToken.connect(initialHolder).delegate(secondAccount.address)
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))        
        expect(await trustToken.getCurrentVotes(secondAccount.address)).to.eq(parseTRU(1000))        
      })
    })
  })

  describe('delegateBySig', () => {
    //TODO
  })

  describe('transfer', () => {
    describe('transfer TRU before delegation', () => {
      it('return 0 vote initialHolder and 1000 for secondAccount', async() => {
        await trustToken.connect(initialHolder).transfer(secondAccount.address,parseTRU(1000))
        expect(await trustToken.balanceOf(secondAccount.address)).to.eq(parseTRU(1000));
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))        
      })
    })
    describe('transfer TRU after delegation', () => {
      it('return 0 vote initialHolder and 1000 for secondAccount', async() => {
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        await trustToken.connect(initialHolder).transfer(secondAccount.address,parseTRU(1000))
        expect(await trustToken.balanceOf(secondAccount.address)).to.eq(parseTRU(1000));
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))        
        expect(await trustToken.getCurrentVotes(secondAccount.address)).to.eq(parseTRU(0))        
      })
    })
  })



})
