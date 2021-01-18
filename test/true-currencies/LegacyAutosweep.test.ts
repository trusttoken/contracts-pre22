import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'

import { beforeEachWithFixture } from 'utils'

import {
  MockTrueCurrencyWithAutosweepFactory,
  MockTrueCurrencyWithAutosweep,
} from 'contracts'

describe('TrueCurrency - Legacy autosweep', () => {
  let token: MockTrueCurrencyWithAutosweep

  const replaceTail = (address: string, replacer: string) => `${address.slice(0, -replacer.length)}${replacer}`

  beforeEachWithFixture(async () => {
    const provider = new MockProvider()
    const [owner] = provider.getWallets()
    token = await new MockTrueCurrencyWithAutosweepFactory(owner).deploy()
    await token.mint(owner.address, 100)
  })

  const testAutosweepAddress = (address: string) =>
    describe(address, () => {
      it('throws on transfer to autosweep addresses', async () => {
        await expect(token.transfer(replaceTail(address, '00000'), 10))
          .to.be.revertedWith('Autosweep is disabled')

        await expect(token.transfer(replaceTail(address, '10'), 10))
          .to.be.revertedWith('Autosweep is disabled')

        await expect(token.transfer(replaceTail(address, 'fffff'), 10))
          .to.be.revertedWith('Autosweep is disabled')
      })

      it('allows transfers to autosweep root', async () => {
        await expect(token.transfer(address, 10)).to.be.not.reverted
      })

      it('replacing more than 5 last digits does not trigger autosweep', async () => {
        await expect(token.transfer(replaceTail(address, '000000'), 10)).to.be.not.reverted
      })
    })

  testAutosweepAddress('0x33091de8341533468d13a80c5a670f4f47cc649f')
  testAutosweepAddress('0x50e2719208914764087e68c32bc5aac321f5b04d')
  testAutosweepAddress('0x71d69e5481a9b7be515e20b38a3f62dab7170d78')
  testAutosweepAddress('0x90fdaa85d52db6065d466b86f16bf840d514a488')
})
