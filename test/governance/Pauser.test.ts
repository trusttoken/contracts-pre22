import { Timelock, TrustToken, Pauser, Timelock__factory, TrustToken__factory, Pauser__factory, OwnedUpgradeabilityProxy } from "contracts";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { providers, Wallet } from "ethers";
import { beforeEachWithFixture, DAY, parseTRU } from "utils";
import { deployContract } from 'scripts/utils/deployContract'

use(solidity)

describe('Pauser', () => {
  let owner: Wallet, holder1: Wallet, holder2: Wallet, holder3: Wallet
  let timelock: Timelock
  let trustToken: TrustToken
  let stkTru: TrustToken
  let pauser: Pauser
  let provider: providers.JsonRpcProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, holder1, holder2] = wallets
    provider = _provider

    timelock = await deployContract(owner, Timelock__factory)
    trustToken = await deployContract(owner, TrustToken__factory)
    stkTru = await deployContract(owner, TrustToken__factory)
    pauser = await deployContract(owner, Pauser__factory)

    await timelock.initialize(owner.address, 200000)
    await trustToken.initialize()
    await stkTru.initialize()
    await pauser.initialize(timelock.address, trustToken.address, stkTru.address, DAY)

    await timelock.setPauser(pauser.address)
  })

  describe('initializer', () => {
    it('sets timelock address', async () => {
      expect(await pauser.timelock()).to.eq(timelock.address)
    })

    it('sets trust token address', async () => {
      expect(await pauser.trustToken()).to.eq(trustToken.address)
    })

    it('sets staked tru address', async () => {
      expect(await pauser.stkTRU()).to.eq(stkTru.address)
    })

    it('sets voting period', async () => {
      expect(await pauser.votingPeriod()).to.eq(DAY)
    })
  })
})