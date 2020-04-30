import { MockProvider, loadFixture } from 'ethereum-waffle'
import { Wallet } from 'ethers'

export type Fixture<T> = (provider: MockProvider, wallets: Wallet[]) => Promise<T>;

export function beforeEachWithFixture (fixture: Fixture<void>) {
  beforeEach(() => loadFixture(fixture))
}
