import { waffle } from 'hardhat'
import type { MockProvider } from 'ethereum-waffle'
import type { Wallet } from 'ethers'

export type Fixture<T> = (wallets: Wallet[], provider: MockProvider) => Promise<T>;

export const loadFixture = waffle.createFixtureLoader(
  waffle.provider.getWallets(),
  waffle.provider,
)

export function beforeEachWithFixture(fixture: Fixture<void>) {
  beforeEach(() => loadFixture(fixture))
}
