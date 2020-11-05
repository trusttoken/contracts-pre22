import { ContractFactory } from 'ethers'
import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'

import { Newable } from 'scripts/utils'

import { TrueCurrency } from 'contracts/types/TrueCurrency'
import {
  TrueCadFactory,
  TrueAudFactory,
  TrueGbpFactory,
  TrueHkdFactory,
} from 'contracts'

describe('TrueCurrency - Tokens', () => {
  function shouldHaveCorrectAttributes (TokenFactory: Newable<ContractFactory>, name: string, symbol: string) {
    describe(`${name} attributes`, () => {
      let token: TrueCurrency

      before(async () => {
        const provider = new MockProvider()
        const [owner] = provider.getWallets()
        token = await new TokenFactory(owner).deploy() as TrueCurrency
      })

      it('name', async () => {
        expect(await token.name()).to.equal(name)
      })

      it('symbol', async () => {
        expect(await token.symbol()).to.equal(symbol)
      })

      it('decimals', async () => {
        expect(await token.decimals()).to.equal(18)
      })
    })
  }

  shouldHaveCorrectAttributes(TrueAudFactory, 'TrueAUD', 'TAUD')
  shouldHaveCorrectAttributes(TrueCadFactory, 'TrueCAD', 'TCAD')
  shouldHaveCorrectAttributes(TrueGbpFactory, 'TrueGBP', 'TGBP')
  shouldHaveCorrectAttributes(TrueHkdFactory, 'TrueHKD', 'THKD')
})
