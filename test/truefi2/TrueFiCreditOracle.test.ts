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
  let firstAccount: Wallet
  let oracle: TrueFiCreditOracle

  beforeEachWithFixture(async (wallets) => {
    ([owner, firstAccount] = wallets)

    oracle = await new TrueFiCreditOracle__factory(owner).deploy()
    await oracle.initialize()
  })

  describe('set and get credit scores', () => {
    const firstScore = 100
    const secondScore = 200

    beforeEach(async () => {
      await oracle.connect(owner).setScore(firstAccount.address, firstScore)
    })

    it('score is set correctly for account', async () => {
      expect(await oracle.getScore(firstAccount.address)).to.equal(firstScore)
    })

    it('cannot set from non-owner account', async () => {
      await expect(oracle.connect(firstAccount).setScore(firstAccount.address, 1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('change existing score', async () => {
      await oracle.setScore(firstAccount.address, secondScore)
      expect(await oracle.getScore(firstAccount.address)).to.equal(secondScore)
    })
  })
})
