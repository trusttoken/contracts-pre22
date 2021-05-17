import { Timelock, TrustToken, Pauser, Timelock__factory, TrustToken__factory, Pauser__factory, OwnedUpgradeabilityProxy, OwnedProxyWithReference, ImplementationReference, MockPauseableContract, OwnedUpgradeabilityProxy__factory, OwnedProxyWithReference__factory, ImplementationReference__factory, MockPauseableContract__factory } from "contracts";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { providers, Wallet } from "ethers";
import { beforeEachWithFixture, DAY, parseTRU } from "utils";
import { deployContract } from 'scripts/utils/deployContract'

use(solidity)

describe('Pauser', () => {
  enum RequestState {
    Pending, Active, Succeeded, Expired, Executed
  } 
  enum PausingMethod { Status, Proxy, Reference }

  let owner: Wallet, holder1: Wallet, holder2: Wallet, holder3: Wallet
  let timelock: Timelock
  let trustToken: TrustToken
  let stkTru: TrustToken
  let pauser: Pauser
  let standardProxy: OwnedUpgradeabilityProxy
  let referenceProxy: OwnedProxyWithReference
  let reference: ImplementationReference
  let pauseable: MockPauseableContract
  let provider: providers.JsonRpcProvider

  let target: string[]
  let methods: PausingMethod[]

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, holder1, holder2, holder3] = wallets
    provider = _provider

    timelock = await deployContract(owner, Timelock__factory)
    trustToken = await deployContract(owner, TrustToken__factory)
    stkTru = await deployContract(owner, TrustToken__factory)
    pauser = await deployContract(owner, Pauser__factory)
    standardProxy = await deployContract(owner, OwnedUpgradeabilityProxy__factory)
    reference = await deployContract(owner, ImplementationReference__factory, [owner.address])
    referenceProxy = await deployContract(owner, OwnedProxyWithReference__factory, [owner.address, reference.address])
    pauseable = await deployContract(owner, MockPauseableContract__factory)

    await timelock.initialize(owner.address, 200000)
    await trustToken.initialize()
    await stkTru.initialize()
    await pauser.initialize(timelock.address, trustToken.address, stkTru.address, DAY)

    await stkTru.mint(holder1.address, parseTRU(25e5))
    await stkTru.connect(holder1).delegate(holder1.address)

    await timelock.setPauser(pauser.address)

    target = [standardProxy.address, referenceProxy.address, pauseable.address]
    methods = [PausingMethod.Proxy, PausingMethod.Reference, PausingMethod.Status]
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

  describe('makeRequest', () => {
    describe('get request ID', () => {
      it('returns id equals to 1', async () => {
        await pauser.connect(holder1).makeRequest(target, methods)
        expect(await pauser.latestRequestIds(holder1.address)).to.eq(1)
      })
    })

    describe('reverts if', () => {
      it('requester has not enough votes', async () => {
        await expect(pauser.connect(holder2).makeRequest([], []))
          .to.be.revertedWith('Pauser::request: requester votes below request threshold')
      })

      it('targets length does not match methods length', async () => {
        await expect(pauser.connect(holder1).makeRequest([standardProxy.address, referenceProxy.address], [PausingMethod.Proxy]))
          .to.be.revertedWith('Pauser::request: request function information arity mismatch')

        await expect(pauser.connect(holder1).makeRequest([standardProxy.address], [PausingMethod.Proxy, PausingMethod.Reference]))
          .to.be.revertedWith('Pauser::request: request function information arity mismatch')
      })

      it('no actions provided', async () => {
        await expect(pauser.connect(holder1).makeRequest([], []))
          .to.be.revertedWith('Pauser::request: must provide actions')
      })

      it('too many actions provided', async () => {
        await expect(pauser.connect(holder1).makeRequest(Array(11).fill(standardProxy.address), Array(11).fill(PausingMethod.Proxy)))
          .to.be.revertedWith('Pauser::request: too many actions')
      })
    })

    it('creates request with correct parameters', async () => {
      const timestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp
      await pauser.connect(holder1).makeRequest(target, methods)
      const id = await pauser.latestRequestIds(holder1.address)
      const request = await pauser.requests(id)
      expect(request.startTime).to.be.gt(timestamp)
      expect(request.endTime.sub(request.startTime)).to.equal(DAY)
      expect(request.requester).to.equal(holder1.address)
    })
  })
})