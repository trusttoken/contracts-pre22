import { expect, use } from 'chai'
import { deployMockContract, MockProvider, solidity } from 'ethereum-waffle'
import { Contract, Wallet } from 'ethers'
import { beforeEachWithFixture, parseTRU, timeTravel } from 'utils'

import {
  TrueFiVault,
  TrueFiVault__factory,
} from 'contracts'
import {
  IERC20Json,
  StkTruTokenJson,
} from 'build'

use(solidity)

describe('TrueFiVault', () => {
  let owner: Wallet
  let beneficiary: Wallet
  let provider: MockProvider

  let tru: Contract
  let stkTru: Contract

  let trueFiVault: TrueFiVault

  const TRU_AMOUNT = parseTRU(1000)
  const STKTRU_AMOUNT = parseTRU(2000)
  const dayInSeconds = 60 * 60 * 24
  const DURATION = 180 * dayInSeconds

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, beneficiary] = wallets
    provider = _provider

    tru = await deployMockContract(owner, IERC20Json.abi)
    await tru.mock.transferFrom.returns(true)
    stkTru = await deployMockContract(owner, StkTruTokenJson.abi)
    await stkTru.mock.delegate.returns()

    trueFiVault = await new TrueFiVault__factory(owner).deploy(
      beneficiary.address,
      TRU_AMOUNT,
      DURATION,
      tru.address,
      stkTru.address,
    )
  })

  describe('Constructor', () => {
    it('sets owner to msg.sender', async () => {
      expect(await trueFiVault.owner()).to.equal(owner.address)
    })

    it('sets beneficiary', async () => {
      expect(await trueFiVault.beneficiary()).to.equal(beneficiary.address)
    })

    it('reverts if owner has less than amount', async () => {
      await tru.mock.transferFrom.returns(false)
      await expect(new TrueFiVault__factory(owner).deploy(
        beneficiary.address,
        TRU_AMOUNT,
        DURATION,
        tru.address,
        stkTru.address,
      )).to.be.revertedWith('TrueFiVault: insufficient owner balance')
    })

    it('transfers amount from owner', async () => {
      await tru.mock.transferFrom.returns(true)
      const constructedVault = await new TrueFiVault__factory(owner).deploy(
        beneficiary.address,
        TRU_AMOUNT,
        DURATION,
        tru.address,
        stkTru.address,
      )
      expect('transferFrom').to.be.calledOnContractWith(tru, [owner.address, constructedVault.address, TRU_AMOUNT])
    })

    it('delegates stkTRU to beneficiary', async () => {
      await stkTru.mock.delegate.withArgs(beneficiary.address).returns()
      await new TrueFiVault__factory(owner).deploy(
        beneficiary.address,
        TRU_AMOUNT,
        DURATION,
        tru.address,
        stkTru.address,
      )
      expect('delegate').to.be.calledOnContractWith(stkTru, [beneficiary.address])
    })
  })

  describe('Withdraw to owner', () => {
    beforeEach(async () => {
      await tru.mock.balanceOf.withArgs(trueFiVault.address).returns(TRU_AMOUNT)
      await tru.mock.transfer.withArgs(owner.address, TRU_AMOUNT).returns(true)
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(STKTRU_AMOUNT)
      await stkTru.mock.transfer.withArgs(owner.address, STKTRU_AMOUNT).returns(true)
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
    })

    it('reverts with wrong caller', async () => {
      await expect(trueFiVault.connect(beneficiary).withdrawToOwner()).to.be.revertedWith('TrueFiVault: only owner')
    })

    it('claims rewards', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('transfers TRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(tru, [owner.address, TRU_AMOUNT])
    })

    it('transfers stkTRU to owner', async () => {
      await trueFiVault.connect(owner).withdrawToOwner()
      expect('transfer').to.be.calledOnContractWith(stkTru, [owner.address, STKTRU_AMOUNT])
    })

    it('emits event', async () => {
      await expect(trueFiVault.connect(owner).withdrawToOwner()).to.emit(trueFiVault, 'WithdrawTo').withArgs(owner.address)
    })
  })

  describe('Withdraw to beneficiary', () => {
    beforeEach(async () => {
      await tru.mock.balanceOf.withArgs(trueFiVault.address).returns(TRU_AMOUNT)
      await tru.mock.transfer.withArgs(beneficiary.address, TRU_AMOUNT).returns(true)
      await stkTru.mock.balanceOf.withArgs(trueFiVault.address).returns(STKTRU_AMOUNT)
      await stkTru.mock.transfer.withArgs(beneficiary.address, STKTRU_AMOUNT).returns(true)
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
    })

    it('reverts with wrong caller', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(owner).withdrawToBeneficiary()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('reverts before expiry', async () => {
      await timeTravel(provider, DURATION - 10)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary()).to.be.revertedWith('TrueFiVault: beneficiary cannot withdraw before expiration')
    })

    it('claims rewards', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('transfers TRU to beneficiary', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(tru, [beneficiary.address, TRU_AMOUNT])
    })

    it('transfers stkTRU to beneficiary', async () => {
      await timeTravel(provider, DURATION + 1)
      await trueFiVault.connect(beneficiary).withdrawToBeneficiary()
      expect('transfer').to.be.calledOnContractWith(stkTru, [beneficiary.address, STKTRU_AMOUNT])
    })

    it('emits event', async () => {
      await timeTravel(provider, DURATION + 1)
      await expect(trueFiVault.connect(beneficiary).withdrawToBeneficiary()).to.emit(trueFiVault, 'WithdrawTo').withArgs(beneficiary.address)
    })
  })

  describe('Delegate beneficiary stkTruToken calls', () => {
    it('reverts stake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).stake(TRU_AMOUNT)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates stake from beneficiary', async () => {
      await stkTru.mock.stake.withArgs(TRU_AMOUNT).returns()
      await trueFiVault.connect(beneficiary).stake(TRU_AMOUNT)
      expect('stake').to.be.calledOnContractWith(stkTru, [TRU_AMOUNT])
    })

    it('reverts unstake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).unstake(TRU_AMOUNT)).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates unstake from beneficiary', async () => {
      await stkTru.mock.unstake.withArgs(TRU_AMOUNT).returns()
      await trueFiVault.connect(beneficiary).unstake(TRU_AMOUNT)
      expect('unstake').to.be.calledOnContractWith(stkTru, [TRU_AMOUNT])
    })

    it('reverts cooldown from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).cooldown()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates cooldown from beneficiary', async () => {
      await stkTru.mock.cooldown.returns()
      await trueFiVault.connect(beneficiary).cooldown()
      expect('cooldown').to.be.calledOnContract(stkTru)
    })

    it('reverts claimRewards from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRewards()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates claimRewards from beneficiary', async () => {
      await stkTru.mock.claimRewards.withArgs(tru.address).returns()
      await trueFiVault.connect(beneficiary).claimRewards()
      expect('claimRewards').to.be.calledOnContractWith(stkTru, [tru.address])
    })

    it('reverts claimRestake from non-beneficiary', async () => {
      await expect(trueFiVault.connect(owner).claimRestake()).to.be.revertedWith('TrueFiVault: only beneficiary')
    })

    it('delegates claimRestake from beneficiary', async () => {
      await stkTru.mock.claimRestake.returns()
      await trueFiVault.connect(beneficiary).claimRestake()
      expect('claimRestake').to.be.calledOnContract(stkTru)
    })
  })
})
