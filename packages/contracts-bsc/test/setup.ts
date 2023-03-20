import { Fixture, MockProvider } from 'ethereum-waffle'
import { waffle } from 'hardhat'
import { Wallet } from 'ethers'
import './utils/hardhatPatches.ts'

type FixtureLoader = ReturnType<typeof waffle.createFixtureLoader>
interface FixtureReturns {
  provider: MockProvider,
  wallet: Wallet,
  other: Wallet,
  another: Wallet,
}

let loadFixture: ReturnType<typeof setupOnce> | undefined
export function setupFixtureLoader() {
  if (!loadFixture) {
    loadFixture = setupOnce()
  }
  return loadFixture
}

type CurrentLoader = { loader: FixtureLoader, returns: FixtureReturns, fixture: Fixture<any> }

function setupOnce() {
  let currentLoader: CurrentLoader = {
    loader: {} as FixtureLoader,
    returns: {} as FixtureReturns,
    fixture: {} as Fixture<any>,
  }

  async function makeLoader(): Promise<{ loader: FixtureLoader, returns: FixtureReturns }> {
    const { provider } = waffle
    await provider.send('hardhat_reset', [])
    const [wallet, other, another, ...rest] = provider.getWallets()
    const loader = waffle.createFixtureLoader([wallet, other, another, ...rest], provider)
    const returns = { provider, wallet, other, another }
    return { loader, returns }
  }

  async function loadFixture<T>(fixture: Fixture<T>): Promise<T & FixtureReturns> {
    // This function creates a new provider for each fixture, because of bugs
    // in ganache that clear contract code on evm_revert
    const { loader, returns } = currentLoader.fixture === fixture ? currentLoader : await makeLoader()
    currentLoader = { fixture, loader, returns }
    const result = await loader(fixture)
    return { ...returns, ...result }
  }

  return loadFixture
}
