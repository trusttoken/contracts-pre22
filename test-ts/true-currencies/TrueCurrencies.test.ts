import { ContractFactory } from 'ethers'
import { MockProvider } from 'ethereum-waffle'
import { expect } from 'chai'
import { Newable } from '../../scripts/utils'
import { TrueCurrency } from 'build/types/TrueCurrency'
import { TrueCadFactory } from 'build/types/TrueCadFactory'
import { TrueAudFactory } from 'build/types/TrueAudFactory'
import { TrueGbpFactory } from 'build/types/TrueGbpFactory'
import { TrueHkdFactory } from 'build/types/TrueHkdFactory'

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
