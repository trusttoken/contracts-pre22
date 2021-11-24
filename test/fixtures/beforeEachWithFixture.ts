import { waffle } from 'hardhat'
import { proxyProvider } from 'utils/hardhatCallHistoryProvider'
import type { MockProvider } from 'ethereum-waffle'
import type { Wallet } from 'ethers'

export type Fixture<T> = (wallets: Wallet[], provider: MockProvider) => Promise<T>;

export const loadFixture = waffle.createFixtureLoader(
  proxyProvider.getWallets(),
  proxyProvider,
)

export function beforeEachWithFixture (fixture: Fixture<void>) {
  proxyProvider.clearCallHistory()
  beforeEach(() => loadFixture(fixture))
}
