import { Wallet } from 'ethers'

import { beforeEachWithFixture } from '../../utils/beforeEachWithFixture'

import { MockErc20Token } from '../../../build/types/MockErc20Token'
import { MockErc20TokenFactory } from '../../../build/types/MockErc20TokenFactory'
import { ArbitraryDistributor } from '../../../build/types/ArbitraryDistributor'
import { ArbitraryDistributorFactory } from '../../../build/types/ArbitraryDistributorFactory'
import { parseEther } from 'ethers/lib/utils'
import { expect } from 'chai'

describe('ArbitraryDistributor', () => {
  let trustToken: MockErc20Token
  let distributor: ArbitraryDistributor
  let owner: Wallet
  let otherWallet: Wallet

  const totalAmount = parseEther('1000')

  beforeEachWithFixture(async (wallets) => {
    [owner, otherWallet] = wallets

    trustToken = await new MockErc20TokenFactory(owner).deploy()
    distributor = await new ArbitraryDistributorFactory(owner).deploy()

    await trustToken.mint(distributor.address, totalAmount)
    await distributor.initialize(owner.address, trustToken.address, totalAmount)
  })

  describe('initialize', () => {
    it('properly saves beneficiary address', async () => {
      expect(await distributor.beneficiary()).to.equal(owner.address)
    })

    it('properly saves trustToken address', async () => {
      expect(await distributor.trustToken()).to.equal(trustToken.address)
    })

    it('properly saves amount to distribute', async () => {
      expect(await distributor.amount()).to.equal(totalAmount)
    })

    it('properly saves remaining amount to distribute', async () => {
      expect(await distributor.remaining()).to.equal(totalAmount)
    })
  })

  describe('distribute', () => {
    const distributedAmount = 100

    it('only predefined beneficiary can call it', async () => {
      await expect(distributor.connect(otherWallet).distribute(distributedAmount))
        .to.be.revertedWith('ArbitraryDistributor: Only beneficiary can distribute tokens')
    })

    it('properly sends tokens', async () => {
      await expect(() => distributor.distribute(distributedAmount))
        .to.changeTokenBalances(trustToken, [distributor, owner], [-distributedAmount, distributedAmount])
    })

    it('properly updates remaining tokens value', async () => {
      await distributor.distribute(distributedAmount)
      expect(await distributor.remaining()).to.equal(totalAmount.sub(distributedAmount))
    })
  })

  describe('withdraw', () => {
    const withdrawnAmount = 100

    it('only owner can withdraw', async () => {
      await expect(distributor.connect(otherWallet).withdraw(withdrawnAmount))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('transfer demanded amount to sender', async () => {
      await expect(() => distributor.withdraw(withdrawnAmount))
        .to.changeTokenBalance(trustToken, owner, withdrawnAmount)
    })

    it('changes remaining variable', async () => {
      const remainingBefore = await distributor.remaining()
      await distributor.withdraw(withdrawnAmount)
      const remainingAfter = await distributor.remaining()
      expect(remainingBefore.sub(remainingAfter)).to.equal(withdrawnAmount)
    })
  })
})
