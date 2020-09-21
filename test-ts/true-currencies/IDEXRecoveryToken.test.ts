import { Wallet, utils } from 'ethers'
import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'
import { MockIdexRecoveryToken } from '../../build/types/MockIDEXRecoveryToken'
import { MockIdexRecoveryTokenFactory } from '../../build/types/MockIDEXRecoveryTokenFactory'
import { setupDeploy } from '../../scripts/utils'
import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'

const initialSupply = utils.parseEther('1000')

describe('TrueCurrency - IDEX Recovery', () => {
  let owner: Wallet
  // let secondAccount: Wallet
  // let thirdAccount: Wallet
  let token: MockIdexRecoveryToken

  beforeEachWithFixture(async (provider: MockProvider, wallets: Wallet[]) => {
    [owner/* secondAccount, thirdAccount */] = wallets
    const deployContract = setupDeploy(owner)
    const implementation = await deployContract(MockIdexRecoveryTokenFactory)
    const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    token = implementation.attach(proxy.address)
    await proxy.upgradeTo(implementation.address)
    await token.initialize()
    await token.mint(owner.address, initialSupply)
  })

  describe('IDEX recovery', async () => {
    beforeEach(async () => {
      // todo: execute upgrade and
    })

    it('flash upgrade successful', async () => {
      // todo: ensure flash upgrade is successful
      expect('1').to.be('1')
    })

    it('distribution contract configured correctly', async () => {
      // todo: test distribution contract configured
      expect('1').to.be('1')
    })

    describe('IDEX recovery', () => {
      it('distributes funds', async () => {
        // todo test funds are distributed vs. spreadhsheet
        expect('1').to.be('1')
      })
    })
  })
})
