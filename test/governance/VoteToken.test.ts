import { expect, use } from 'chai'
import { providers, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  parseTRU,
  timeTravelTo,
  timeTravel,
} from 'utils'

import {
  TrustTokenFactory,
  TrustToken,
} from 'contracts'

use(solidity)

describe('VoteToken', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.initialize()
    await trustToken.mint(initialHolder.address, parseTRU(1000))
    await trustToken.mint(timeLockRegistry.address, parseTRU(1000))
    await trustToken.setTimeLockRegistry(timeLockRegistry.address)
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
    describe('when saftHolder token is locked', () => {
      const DAY = 24 * 3600
      const initializationTimestamp = 1595609911
      beforeEach(async () => {
        await timeTravelTo(provider, initializationTimestamp)
        await trustToken.connect(timeLockRegistry).registerLockup(saftHolder.address, parseTRU(100))
      })
      it('return 0 for unlocked balance and 100 for balance', async () => {
        expect(await trustToken.balanceOf(saftHolder.address)).to.eq(parseTRU(100))
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.eq(parseTRU(0))
      })
      describe('when saftHolder delegate to itself', () => {
        it('return 0 for current vote', async () => {
          await trustToken.connect(saftHolder).delegate(saftHolder.address)
          expect(await trustToken.getCurrentVotes(saftHolder.address)).to.eq(parseTRU(0))
        })
      })
      describe('when saftHolder delegate to others', () => {
        it('return 0 for current vote', async () => {
          await trustToken.connect(saftHolder).delegate(secondAccount.address)
          expect(await trustToken.getCurrentVotes(secondAccount.address)).to.eq(parseTRU(0))
        })
      })
      describe('when time travel 210 days -> 2 epochs', () => {
        beforeEach(async () => {
          await timeTravel(provider, DAY * 210)
        })
        it('return 25 for unlocked balance and 100 for balance', async () => {
          expect(await trustToken.balanceOf(saftHolder.address)).to.eq(parseTRU(100))
          expect(await trustToken.unlockedBalance(saftHolder.address)).to.eq(parseTRU(25))
        })
        it('return 25 vote when delegate to itself', async () => {
          await trustToken.connect(saftHolder).delegate(saftHolder.address)
          expect(await trustToken.getCurrentVotes(saftHolder.address)).to.eq(parseTRU(25))
        })
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

  describe('getPriorVotes', () => {
    let curBlockNumber = 0
    beforeEach(async () => {
      await trustToken.connect(initialHolder).delegate(initialHolder.address)
      curBlockNumber = await provider.getBlockNumber()
      timeTravel(provider, 60) // mine one block
    })
    describe('when trying to get prior votes', async () => {
      it('return 1000 votes at block 6', async () => {
        expect(await trustToken.getPriorVotes(initialHolder.address, curBlockNumber)).to.eq(parseTRU(1000))
      })
      it('return 0 votes at block 5', async () => {
        expect(await trustToken.getPriorVotes(initialHolder.address, curBlockNumber - 1)).to.eq(parseTRU(0))
      })
    })
  })

  describe('transfer', () => {
    describe('transfer TRU before delegation', () => {
      it('return 0 vote initialHolder and 1000 for secondAccount', async () => {
        await trustToken.connect(initialHolder).transfer(secondAccount.address, parseTRU(1000))
        await trustToken.connect(secondAccount).delegate(secondAccount.address)
        expect(await trustToken.balanceOf(secondAccount.address)).to.eq(parseTRU(1000))
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))
        expect(await trustToken.getCurrentVotes(secondAccount.address)).to.eq(parseTRU(1000))
      })
    })
    describe('transfer TRU after delegation', () => {
      it('return 0 vote initialHolder and 1000 for secondAccount', async () => {
        await trustToken.connect(secondAccount).delegate(secondAccount.address)
        await trustToken.connect(initialHolder).transfer(secondAccount.address, parseTRU(1000))
        expect(await trustToken.balanceOf(secondAccount.address)).to.eq(parseTRU(1000))
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(0))
        expect(await trustToken.getCurrentVotes(secondAccount.address)).to.eq(parseTRU(1000))
      })
    })
  })

  describe('mint', () => {
    describe('mints TRU before delegation', () => {
      it('add votes on mint', async () => {
        await trustToken.mint(initialHolder.address, parseTRU(1000))
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(2000))
      })
    })

    describe('mints TRU after delegation', () => {
      it('add votes on mint', async () => {
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        await trustToken.mint(initialHolder.address, parseTRU(1000))
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(2000))
      })
    })
  })

  describe('burn', () => {
    describe('mints TRU before delegation', () => {
      it('add votes on mint', async () => {
        await trustToken.connect(initialHolder).burn(parseTRU(500))
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(500))
      })
    })

    describe('mints TRU after delegation', () => {
      it('add votes on mint', async () => {
        await trustToken.connect(initialHolder).delegate(initialHolder.address)
        await trustToken.connect(initialHolder).burn(parseTRU(500))
        expect(await trustToken.getCurrentVotes(initialHolder.address)).to.eq(parseTRU(500))
      })
    })
  })
})
