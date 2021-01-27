import { expect, use } from 'chai'
import { providers, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import { beforeEachWithFixture, DAY, parseEth, parseTRU, timeTravel } from 'utils'

import {
  MockOracle,
  MockOracleFactory,
  MockTrueCurrency,
  MockTrueCurrencyFactory,
  StkTruToken,
  StkTruTokenFactory,
  TrustToken,
  TrustTokenFactory,
} from 'contracts'

use(solidity)

describe('StkTruToken', () => {
  let owner: Wallet
  let staker: Wallet
  let trustToken: TrustToken
  let stkToken: StkTruToken
  let tusd: MockTrueCurrency
  let oracle: MockOracle
  let provider: providers.JsonRpcProvider

  const amount = parseTRU(100)
  const stakeCooldown = DAY * 14

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, staker] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.initialize()
    tusd = await deployContract(MockTrueCurrencyFactory)
    oracle = await deployContract(MockOracleFactory)

    stkToken = await deployContract(StkTruTokenFactory)
    await stkToken.initialize(trustToken.address, tusd.address, oracle.address)

    await trustToken.mint(owner.address, amount)
    await trustToken.approve(stkToken.address, amount)
  })

  describe('Oracle', () => {
    it('only owner can change oracle', async () => {
      await expect(stkToken.connect(staker).setOracle(staker.address)).to.be.revertedWith('only owner')
    })

    it('emits event', async () => {
      await expect(stkToken.setOracle(staker.address)).to.emit(stkToken, 'OracleChanged')
        .withArgs(staker.address)
      expect(await stkToken.oracle()).to.equal(staker.address)
    })
  })

  describe('Staking-Unstaking', () => {
    it('stake emits event', async () => {
      await expect(stkToken.stake(amount)).to.emit(stkToken, 'Stake').withArgs(owner.address, amount, amount)
    })

    it('unstake emits event', async () => {
      await stkToken.stake(amount)
      await timeTravel(provider, stakeCooldown)
      await expect(stkToken.unstake(amount)).to.emit(stkToken, 'Unstake').withArgs(owner.address, amount, amount, 0)
    })

    it('tokens are burnt on unstake', async () => {
      await stkToken.stake(amount)
      await timeTravel(provider, stakeCooldown)
      await stkToken.unstake(amount)
      expect(await stkToken.totalSupply()).to.equal(0)
    })

    it('cannot unstake before cooldown has passed', async () => {
      await stkToken.stake(amount)
      await timeTravel(provider, stakeCooldown - DAY)
      await expect(stkToken.unstake(amount)).to.be.revertedWith('StkTruToken: Stake is locked')
    })

    describe('single user', () => {
      it('stakes, unstakes, gets same amount of TRU', async () => {
        await stkToken.stake(amount)
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount)
      })

      it('stakes, then some TRU and TUSD are transferred to stake, then unstake', async () => {
        await stkToken.stake(amount)
        await trustToken.mint(stkToken.address, parseTRU(10))
        await tusd.mint(stkToken.address, parseEth(10))
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount.add(parseTRU(10)))
        expect(await tusd.balanceOf(owner.address)).to.equal(parseEth(10))
      })

      it('some TRU and TUSD are transferred to stake, then stake & unstake', async () => {
        await trustToken.mint(stkToken.address, parseTRU(10))
        await tusd.mint(stkToken.address, parseEth(10))
        await stkToken.stake(amount)
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount.add(parseTRU(10)))
        expect(await tusd.balanceOf(owner.address)).to.equal(parseEth(10))
      })
    })

    describe('multiple users', () => {
      beforeEach(async () => {
        await trustToken.mint(staker.address, amount.div(2))
        await trustToken.connect(staker).approve(stkToken.address, amount.div(2))
      })

      it('no external rewards', async () => {
        await stkToken.stake(amount)
        await stkToken.connect(staker).stake(amount.div(2))
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        await stkToken.connect(staker).unstake(amount.div(2))
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount)
        expect(await trustToken.balanceOf(staker.address)).to.equal(amount.div(2))
      })

      it('with external TRU reward', async () => {
        await stkToken.stake(amount)
        await trustToken.mint(stkToken.address, parseTRU(10))
        await stkToken.connect(staker).stake(amount.div(2))
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        await stkToken.connect(staker).unstake(await stkToken.balanceOf(staker.address))
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount.add(parseTRU(10)))
        expect(await trustToken.balanceOf(staker.address)).to.equal(amount.div(2))
      })

      it('with external TRU added after both users joined', async () => {
        await stkToken.stake(amount)
        await trustToken.mint(stkToken.address, parseTRU(10))
        await stkToken.connect(staker).stake(amount.div(2))
        // owner holds 11/16 of stake at the moment and will get 10*11/16 TRU from the following reward
        await trustToken.mint(stkToken.address, parseTRU(10))
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        await stkToken.connect(staker).unstake(await stkToken.balanceOf(staker.address))
        expect(await trustToken.balanceOf(owner.address)).to.equal(amount.add(parseTRU(10)).add(parseTRU(10).mul(11).div(16)))
        expect(await trustToken.balanceOf(staker.address)).to.equal(amount.div(2).add(parseTRU(10).mul(5).div(16)))
      })

      it('rewards of TRU and TUSD', async () => {
        const totalWalletValue = async (wallet: Wallet) => (await trustToken.balanceOf(wallet.address))
          .add((await tusd.balanceOf(wallet.address)).div(5e10))

        await stkToken.stake(amount)
        await trustToken.mint(stkToken.address, parseTRU(10))
        await tusd.mint(stkToken.address, parseEth(50)) // same as 10 TRU
        await stkToken.connect(staker).stake(amount.div(2))
        // owner holds 12/17 of stake at the moment
        await trustToken.mint(stkToken.address, parseTRU(10))
        await tusd.mint(stkToken.address, parseEth(50)) // same as 10 TRU
        await timeTravel(provider, stakeCooldown)
        await stkToken.unstake(amount)
        await stkToken.connect(staker).unstake(await stkToken.balanceOf(staker.address))

        expect(await totalWalletValue(owner)).to.equal(amount.add(parseTRU(20)).add(parseTRU(20).mul(12).div(17)))
        expect(await totalWalletValue(staker)).to.equal(amount.div(2).add(parseTRU(20).mul(5).div(17)))
      })
    })
  })
})
