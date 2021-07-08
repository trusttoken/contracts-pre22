import { expect, use } from 'chai'
import { beforeEachWithFixture } from 'utils'
import {
  TrueFiCreditOracle__factory,
  TrueFiCreditOracle,
} from 'contracts'
import { solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'

use(solidity)

describe('TrueFiCreditOracle', () => {
  let owner: Wallet
  let manager: Wallet
  let firstAccount: Wallet
  let oracle: TrueFiCreditOracle

  beforeEachWithFixture(async (wallets) => {
    ([owner, manager, firstAccount] = wallets)

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

  describe('set and get credit scores', () => {
    const firstScore = 100
    const secondScore = 200

    beforeEach(async () => {
      await oracle.connect(manager).setScore(firstAccount.address, firstScore)
    })

    it('only manager can set scores', async () => {
      await expect(oracle.connect(owner).setScore(firstAccount.address, firstScore))
        .to.be.revertedWith('TrueFiCreditOracle: Caller is not the manager')
    })

    it('score is set correctly for account', async () => {
      expect(await oracle.getScore(firstAccount.address)).to.equal(firstScore)
    })

    it('change existing score', async () => {
      await oracle.connect(manager).setScore(firstAccount.address, secondScore)
      expect(await oracle.getScore(firstAccount.address)).to.equal(secondScore)
    })
  })
})
