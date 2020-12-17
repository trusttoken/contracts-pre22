import { expect, use } from 'chai'
import { constants, providers, BigNumberish, BigNumber, Wallet, ethers } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  parseTRU,
} from 'utils'

import {
  TrustTokenFactory,
  TrustToken,
  TimelockFactory,
  Timelock,
  GovernorAlphaFactory,
  GovernorAlpha
} from 'contracts'

use(solidity)

describe('GovernorAlpha', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet, thirdAccount: Wallet, fourthAccount: Wallet
  let timelock: Timelock
  let governorAlpha: GovernorAlpha
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider
  let target, values, signatures, callDatas, description

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount, thirdAccount, fourthAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    
    timelock = await deployContract(TimelockFactory,owner.address,10*24*60*60) //set delay = 10days 
    trustToken = await deployContract(TrustTokenFactory)

    governorAlpha = await deployContract(GovernorAlphaFactory,timelock.address,trustToken.address,owner.address)

    await trustToken.mint(initialHolder.address,parseTRU(14500000*4)) // 4% of tru
    await trustToken.connect(initialHolder).delegate(initialHolder.address) // delegate itself
    
    
  })


  describe('propose', () => {
    describe('get proposal ID', () => {
      it('returns id equals to 1', async () => {
        target = [secondAccount.address]
        values = ['0']
        signatures = ['getBalanceOf(address)']
        callDatas = [encodeParameters(['address'],[thirdAccount.address])]
        description = 'test proposal'
        await governorAlpha.connect(initialHolder).propose(target,values,signatures,callDatas,description)
        expect(await governorAlpha.latestProposalIds(initialHolder.address)).to.eq(1)
      })
    })
  })



})

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}
