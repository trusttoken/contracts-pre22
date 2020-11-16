import { BigNumberish, constants, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { initialSupply, trueCurrency } from 'fixtures/trueCurrency'

import { TrueCurrency } from 'contracts/types/TrueCurrency'

describe('TrueCurrency - ERC20Burnable', () => {
  let initialHolder: Wallet
  let otherAccount: Wallet
  let token: TrueCurrency

  beforeEach(async () => {
    ({ wallets: [initialHolder, otherAccount], token } = await loadFixture(trueCurrency))
  })

  describe('burn', () => {
    async function burn (caller: Wallet, amount: BigNumberish) {
      await token.setCanBurn(caller.address, true)
      return token.connect(caller).burn(amount)
    }

    beforeEach(async () => {
      await token.setBurnBounds(0, initialSupply.mul(2))
    })

    describe('when the given amount is not greater than balance of the sender', () => {
      describe('for a zero amount', () => {
        shouldBurn(0)
      })

      describe('for a non-zero amount', () => {
        shouldBurn(12_000_000)
      })

      function shouldBurn (amount: BigNumberish) {
        it('burns the requested amount', async () => {
          await burn(initialHolder, amount)
          expect(await token.balanceOf(initialHolder.address)).to.eq(initialSupply.sub(amount))
          expect(await token.totalSupply()).to.eq(initialSupply.sub(amount))
        })

        it('emits a transfer event', async () => {
          await expect(burn(initialHolder, amount))
            .to.emit(token, 'Transfer')
            .withArgs(initialHolder.address, constants.AddressZero, amount)
        })
      }
    })

    describe('when the given amount is greater than the balance of the sender', () => {
      it('reverts', async () => {
        await expect(burn(initialHolder, initialSupply.add(12_000_000)))
          .to.be.revertedWith('ERC20: burn amount exceeds balance')
      })
    })

    describe('cannot burn outside burn bounds', () => {
      beforeEach(async () => {
        await token.setBurnBounds(100, 1000)
      })

      describe('when burn amount is below burn bound', () => {
        it('reverts', async () => {
          await expect(burn(initialHolder, 50))
            .to.be.revertedWith('BurnableTokenWithBounds: below min burn bound')
        })
      })

      describe('when burn above is below burn bound', () => {
        it('reverts', async () => {
          await expect(burn(initialHolder, 5000))
            .to.be.revertedWith('BurnableTokenWithBounds: exceeds max burn bound')
        })
      })
    })

    describe('when account that is not allowed to burn tries to burn', () => {
      it('reverts', async () => {
        await expect(token.burn(100))
          .to.be.revertedWith('TrueCurrency: cannot burn from this address')
      })
    })

    describe('when not an owner changes burn bounds', () => {
      it('reverts', async () => {
        await expect(token.connect(otherAccount).setBurnBounds(100, 1000))
          .to.be.revertedWith('only Owner')
      })
    })
  })
})
