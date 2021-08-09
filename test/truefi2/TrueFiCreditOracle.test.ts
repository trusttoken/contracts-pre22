import { expect, use } from 'chai'
import {
  beforeEachWithFixture,
  parseEth,
  timeTravel,
} from 'utils'
import {
  TrueFiCreditOracle__factory,
  TrueFiCreditOracle,
} from 'contracts'
import { solidity, MockProvider } from 'ethereum-waffle'
import { Wallet, ContractTransaction } from 'ethers'

use(solidity)

describe('TrueFiCreditOracle', () => {
  let owner: Wallet
  let manager: Wallet
  let firstAccount: Wallet
  let secondAccount: Wallet
  let oracle: TrueFiCreditOracle
  let provider: MockProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, manager, firstAccount, secondAccount] = wallets)
    provider = _provider

    oracle = await new TrueFiCreditOracle__factory(owner).deploy()
    await oracle.initialize()
    await oracle.setManager(manager.address)
  })

  describe('setManager', () => {
    it('only owner can set manager', async () => {
      await expect(oracle.connect(manager).setManager(manager.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('sets manager address', async () => {
      await oracle.setManager(owner.address)
      expect(await oracle.manager()).to.eq(owner.address)
    })

    it('emits event', async () => {
      await expect(oracle.setManager(owner.address))
        .to.emit(oracle, 'ManagerChanged')
        .withArgs(owner.address)
    })
  })

  describe('setScore', () => {
    const firstScore = 100
    const secondScore = 200
    let time: number
    let tx: ContractTransaction

    beforeEach(async () => {
      tx = await oracle.connect(manager).setScore(firstAccount.address, firstScore)
      const { blockNumber } = await tx.wait()
      time = (await provider.getBlock(blockNumber)).timestamp
    })

    it('only manager can set scores', async () => {
      await expect(oracle.connect(owner).setScore(firstAccount.address, firstScore))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
    })

    it('score is set correctly for account', async () => {
      expect(await oracle.getScore(firstAccount.address)).to.equal(firstScore)
    })

    it('timestamp is set correctly', async () => {
      expect(await oracle.lastUpdated(firstAccount.address)).to.equal(time)
    })

    it('timestamp is updated when setting score', async () => {
      tx = await oracle.connect(manager).setScore(firstAccount.address, firstScore)
      const { blockNumber } = await tx.wait()
      const newTime = (await provider.getBlock(blockNumber)).timestamp
      expect(await oracle.lastUpdated(firstAccount.address)).to.equal(newTime)
    })

    it('emits event', async () => {
      await expect(oracle.connect(manager).setScore(firstAccount.address, secondScore))
        .to.emit(oracle, 'ScoreChanged')
        .withArgs(firstAccount.address, secondScore, time + 1)
    })
  })

  describe('getScore', () => {
    const firstScore = 100
    const secondScore = 200

    it('gets score correctly after it has changed', async () => {
      await oracle.connect(manager).setScore(firstAccount.address, firstScore)
      expect(await oracle.getScore(firstAccount.address)).to.equal(firstScore)
      await oracle.connect(manager).setScore(firstAccount.address, secondScore)
      expect(await oracle.getScore(firstAccount.address)).to.equal(secondScore)
    })

    it('updates lastUpdated timestamp', async () => {
      let tx = await (await oracle.connect(manager).setScore(firstAccount.address, firstScore)).wait()
      expect(await oracle.lastUpdated(firstAccount.address)).to.equal((await provider.getBlock(tx.blockNumber)).timestamp)
      tx = await (await oracle.connect(manager).setScore(firstAccount.address, firstScore)).wait()
      expect(await oracle.lastUpdated(firstAccount.address)).to.equal((await provider.getBlock(tx.blockNumber)).timestamp)
    })
  })

  describe('set and get max borrower limits', () => {
    const firstBorrowLimit = parseEth(100)
    const secondBorrowLimit = parseEth(200)

    beforeEach(async () => {
      await oracle.connect(manager).setMaxBorrowerLimit(firstAccount.address, firstBorrowLimit)
    })

    it('only manager can set max borrower limits', async () => {
      await expect(oracle.connect(owner).setMaxBorrowerLimit(firstAccount.address, firstBorrowLimit))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
    })

    it('max borrower limit is set correctly for account', async () => {
      expect(await oracle.getMaxBorrowerLimit(firstAccount.address)).to.equal(firstBorrowLimit)
    })

    it('change existing max borrower limit', async () => {
      await oracle.connect(manager).setMaxBorrowerLimit(firstAccount.address, secondBorrowLimit)
      expect(await oracle.getMaxBorrowerLimit(firstAccount.address)).to.equal(secondBorrowLimit)
    })
  })

  describe('ineligibility', () => {
    const firstScore = 100
    const secondScore = 200

    beforeEach(async () => {
      await oracle.connect(manager).setScore(firstAccount.address, firstScore)
      await oracle.connect(manager).setScore(secondAccount.address, secondScore)
      await oracle.connect(owner).setIneligible(firstAccount.address, true)
      await oracle.connect(owner).setOnHold(firstAccount.address, true)
    })

    it('ineligibility and on hold set correctly', async () => {
      expect(await oracle.onHold(firstAccount.address)).to.be.true
      expect(await oracle.ineligible(firstAccount.address)).to.be.true
    })

    it('only owner can set ineligibility', async () => {
      await expect(oracle.connect(manager).setIneligible(firstAccount.address, false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('only owner can set onHold', async () => {
      await expect(oracle.connect(manager).setOnHold(firstAccount.address, false))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('setting ineligibility triggers event', async () => {
      await expect(oracle.connect(owner).setIneligible(secondAccount.address, true))
        .to.emit(oracle, 'IneligibleStatusChanged')
        .withArgs(secondAccount.address, true)
    })

    it('setting onHold triggers event', async () => {
      await expect(oracle.connect(owner).setOnHold(secondAccount.address, true))
        .to.emit(oracle, 'OnHoldStatusChanged')
        .withArgs(secondAccount.address, true)
    })
  })
})
