import { expect } from 'chai'
import { Contract, Wallet } from 'ethers'
import { MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { TrueLendingPoolFactory } from '../../build/types/TrueLendingPoolFactory'
import { TrueLendingPool } from '../../build/types/TrueLendingPool'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import ITrueFiPoolJson from '../../build/ITrueFiPool.json'
import { deployMockContract } from 'ethereum-waffle'
import { BigNumberish, parseEther } from 'ethers/utils'

describe('TrueLendingPool', () => {
  let owner: Wallet
  let otherWallet: Wallet
  let lendingPool: TrueLendingPool
  let tusd: MockTrueCurrency
  let underlyingPool: Contract

  beforeEachWithFixture(async (_provider, wallets) => {
    [owner, otherWallet] = wallets
    tusd = await new MockTrueCurrencyFactory(owner).deploy()
    await tusd.initialize()
    underlyingPool = await deployMockContract(owner, ITrueFiPoolJson.abi)
    await underlyingPool.mock.token.returns(tusd.address)
    lendingPool = await new TrueLendingPoolFactory(owner).deploy(underlyingPool.address)
  })

  describe('Constructor', () => {
    it('sets the pool address', async () => {
      expect(await lendingPool.pool()).to.equal(underlyingPool.address)
    })

    it('approves infinite amount to underlying pool', async () => {
      expect(await tusd.allowance(lendingPool.address, underlyingPool.address)).to.equal(MaxUint256)
    })

    it('default params', async () => {
      expect(await lendingPool.minLoanSize()).to.equal(parseEther('1000000'))
      expect(await lendingPool.maxLoanSize()).to.equal(parseEther('10000000'))
      expect(await lendingPool.minApy()).to.equal('1000')
      expect(await lendingPool.minLoanApprovalFactor()).to.equal('7000')
      expect(await lendingPool.minLoanApprovalVoteRatio()).to.equal('7000')
      expect(await lendingPool.burnFactor()).to.equal('8000')
    })
  })

  describe('Whitelisting', () => {
    it('changes whitelist status', async () => {
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.false
      await lendingPool.whitelistForLoan(otherWallet.address, true)
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.true
      await lendingPool.whitelistForLoan(otherWallet.address, false)
      expect(await lendingPool.whitelisted(otherWallet.address)).to.be.false
    })

    it('emits event', async () => {
      await expect(lendingPool.whitelistForLoan(otherWallet.address, true))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, true)
      await expect(lendingPool.whitelistForLoan(otherWallet.address, false))
        .to.emit(lendingPool, 'Whitelisted').withArgs(otherWallet.address, false)
    })

    it('reverts when performed by non-owner', async () => {
      await expect(lendingPool.connect(otherWallet).whitelistForLoan(otherWallet.address, true))
        .to.be.revertedWith('caller is not the owner')
    })
  })

  describe('Parameters set up', () => {
    async function shouldChangeParameters (
      methodName: string,
      values: BigNumberish[],
      getterNames: string[],
      eventName: keyof TrueLendingPool['filters'],
    ) {
      if (typeof methodName !== 'string') {
        return
      }
      describe(methodName, () => {
        it(`changes ${getterNames}`, async () => {
          await lendingPool.functions[methodName](...values)
          for (let i = 0; i < getterNames.length; i++) {
            expect(await lendingPool.functions[getterNames[i]]()).to.equal(values[i])
          }
        })

        it(`emits ${eventName}`, async () => {
          await expect(lendingPool.functions[methodName](...values)).to.emit(lendingPool, eventName).withArgs(...values)
        })

        it('must be called by owner', async () => {
          await expect(lendingPool.connect(otherWallet).functions[methodName](...values)).to.be.revertedWith('caller is not the owner')
        })
      })
    }

    shouldChangeParameters('setLoanBounds', [1000, 100000], ['minLoanSize', 'maxLoanSize'], 'LoanBoundsChanged')
    shouldChangeParameters('setMinApy', [1000], ['minApy'], 'MinApyChanged')
    shouldChangeParameters('setLoanApprovalConditions', [1000, 2000], ['minLoanApprovalFactor', 'minLoanApprovalVoteRatio'], 'LoanApprovalConditionsChanged')
    shouldChangeParameters('setBurnFactor', [1000], ['burnFactor'], 'BurnFactorChanged')

    describe('setLoanBounds', () => {
      it('cannot set minLoanSize to be bigger than maxLoanSize', async () => {
        await expect(lendingPool.setLoanBounds(2, 1)).to.be.revertedWith('maximum loan size smaller than minimal')
      })

      it('can set minLoanSize to same value as maxLoanSize', async () => {
        await expect(lendingPool.setLoanBounds(2, 2)).to.be.not.reverted
      })
    })
  })
})
