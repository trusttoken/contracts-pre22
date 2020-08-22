import { Wallet } from 'ethers'
import { loadFixture, MockProvider } from 'ethereum-waffle'
import { initialSupply } from '../fixtures/trueCurrency'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { setupDeploy } from '../../scripts/utils'
import { MockDeprecatedTrueCurrency } from '../../build/types/MockDeprecatedTrueCurrency'
import { MockDeprecatedTrueCurrencyFactory } from '../../build/types/MockDeprecatedTrueCurrencyFactory'
import { OwnedUpgradeabilityProxyFactory } from '../../build/types/OwnedUpgradeabilityProxyFactory'
import { expect } from 'chai'

describe('TrueCurrency - Test Gas Legacy Refunds', () => {
  let initialHolder: Wallet
  // let secondAccount: Wallet
  let newToken: MockTrueCurrency
  let token: MockDeprecatedTrueCurrency

  const deprecatedTrueCurrencyFixture = async (provider: MockProvider, wallets: Wallet[]) => {
    const [owner, otherAccount] = wallets
    const deployContract = setupDeploy(owner)

    // deploy old TrueCurrency contract
    const implementation = await deployContract(MockDeprecatedTrueCurrencyFactory)
    const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    const token = implementation.attach(proxy.address)
    await proxy.upgradeTo(implementation.address)
    await token.initialize()
    await token.mint(owner.address, initialSupply)
    await token.transfer(otherAccount.address, initialSupply.div(2))
    await token.approve(otherAccount.address, 10)

    /* sponsor a bunch of gas
    for (let i = 0; i < 100; i++) {
      await token.sponsorGas()
      await token.sponsorGas2()
    }
    */
    // deploy new implementation
    const newTokenImplementation = await deployContract(MockTrueCurrencyFactory)

    return { wallets, provider, token, newTokenImplementation }
  }

  // function to upgrade contract to new implementation
  const upgrade = async () => OwnedUpgradeabilityProxyFactory
    .connect(token.address, initialHolder)
    .upgradeTo(newToken.address)

  beforeEach(async () => {
    ({
      wallets: [initialHolder, secondAccount],
      token,
      newTokenImplementation: newToken,
    } = await loadFixture(deprecatedTrueCurrencyFixture))
  })

  it('refund gas #1 works after upgrade', async () => {
    // get amount of slots
    await upgrade()
    // get remaining gas slots
    let remainingSlots = await token.remainingGasStorage()
    console.log('remaining gas slots: ', remaining)
    expect(remainingSlots).to.equal(100)
    // refund some gas
    await token.refundGas2(1)
    remainingSlots = await token.remainingGasStorage()
    expect(remainingSlots).to.equal(99)
    // TODO measure gas used in refund. Ideally we want to
    // have a tokencontroller that can
  })

  it('refund gas #2 works after upgrade', async () => {
    // get amount of slots
    await upgrade()
    // get remaining gas slots
    let remainingSlots = await token.remainingGasSheep()
    console.log('remaining gas sheep: ', remaining)
    expect(remainingSlots).to.equal(100)
    // refund some gas
    await token.refundGas2(1)
    remainingSlots = await token.remainingGasSheep()
    expect(remainingSlots).to.equal(99)
  })
})
