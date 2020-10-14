import { MockProvider, loadFixture } from 'ethereum-waffle'
import { Wallet } from 'ethers'

export type Fixture<T> = (wallets: Wallet[], provider: MockProvider) => Promise<T>;

export function beforeEachWithFixture (fixture: Fixture<void>) {
  beforeEach(() => loadFixture(fixture))
}
