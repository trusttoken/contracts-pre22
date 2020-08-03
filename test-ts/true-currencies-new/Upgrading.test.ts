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

describe('TrueCurrency - Upgrade implementation', () => {
  let initialHolder: Wallet
  let secondAccount: Wallet
  let newToken: MockTrueCurrency
  let token: MockDeprecatedTrueCurrency

  const deprecatedTrueCurrencyFixture = async (provider: MockProvider, wallets: Wallet[]) => {
    const [owner, otherAccount] = wallets
    const deployContract = setupDeploy(owner)

    const implementation = await deployContract(MockDeprecatedTrueCurrencyFactory)
    const proxy = await deployContract(OwnedUpgradeabilityProxyFactory)
    const token = implementation.attach(proxy.address)
    await proxy.upgradeTo(implementation.address)
    await token.initialize()
    await token.mint(owner.address, initialSupply)
    await token.transfer(otherAccount.address, initialSupply.div(2))
    await token.approve(otherAccount.address, 10)
    const newTokenImplementation = await deployContract(MockTrueCurrencyFactory)

    return { wallets, provider, token, newTokenImplementation }
  }

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

  it('upgrade changes token name and symbol', async () => {
    expect(await token.name()).to.equal('OldTrueCurrency')
    expect(await token.symbol()).to.equal('TCUR-OLD')

    await upgrade()

    expect(await token.name()).to.equal('TrueCurrency')
    expect(await token.symbol()).to.equal('TCUR')
  })

  it('keeps balances', async () => {
    await upgrade()

    expect(await token.balanceOf(initialHolder.address)).to.equal(initialSupply.div(2))
    expect(await token.balanceOf(secondAccount.address)).to.equal(initialSupply.div(2))
  })

  it('keeps allowances', async () => {
    await upgrade()

    expect(await token.allowance(initialHolder.address, secondAccount.address)).to.equal(10)
  })

  it('keeps total supply', async () => {
    await upgrade()

    expect(await token.totalSupply()).to.equal(initialSupply)
  })

  it('keeps burn limits', async () => {
    await token.setBurnBounds(10, 100)
    await upgrade()

    expect(await token.burnMin()).to.equal(10)
    expect(await token.burnMax()).to.equal(100)
  })
})
