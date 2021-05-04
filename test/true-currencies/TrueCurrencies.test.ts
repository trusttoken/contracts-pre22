import { ContractFactory } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { expect, use } from 'chai'
import { waffle } from 'hardhat'

import { Newable } from 'scripts/utils'

import { TrueCurrency } from 'contracts'
import {
  TrueCad__factory,
  TrueAud__factory,
  TrueGbp__factory,
  TrueHkd__factory,
} from 'contracts'

use(solidity)

describe('TrueCurrency - Tokens', () => {
  function shouldHaveCorrectAttributes (Token__factory: Newable<ContractFactory>, name: string, symbol: string) {
    describe(`${name} attributes`, () => {
      let token: TrueCurrency

      before(async () => {
        const provider = waffle.provider
        const [owner] = provider.getWallets()
        token = await new Token__factory(owner).deploy() as TrueCurrency
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

  shouldHaveCorrectAttributes(TrueAud__factory, 'TrueAUD', 'TAUD')
  shouldHaveCorrectAttributes(TrueCad__factory, 'TrueCAD', 'TCAD')
  shouldHaveCorrectAttributes(TrueGbp__factory, 'TrueGBP', 'TGBP')
  shouldHaveCorrectAttributes(TrueHkd__factory, 'TrueHKD', 'THKD')
})
