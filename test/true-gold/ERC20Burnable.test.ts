import { BigNumber, BigNumberish, constants, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { initialSupply, setupTrueGold } from 'fixtures/trueGold'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueGold } from 'contracts'

describe('TrueGold - ERC20Burnable', () => {
  let initialHolder: Wallet
  let secondAccount: Wallet
  let token: TrueGold

  function approve (tokenOwner: Wallet, spender: WalletOrAddress, amount: BigNumberish) {
    const asTokenOwner = token.connect(tokenOwner)
    return asTokenOwner.approve(toAddress(spender), amount)
  }

  beforeEach(async () => {
    ({ initialHolder, secondAccount, token } = await loadFixture(setupTrueGold))
  })

  describe('burn', () => {
    function burn (caller: Wallet, amount: BigNumberish) {
      return token.connect(caller).burn(amount)
    }

    describe('when the given amount is not greater than balance of the sender', () => {
      describe('for a zero amount', () => {
        shouldBurn(0)
      })

      describe('for a non-zero amount', () => {
        shouldBurn(12_500_000)
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
        await expect(burn(initialHolder, initialSupply.add(12_500_000)))
          .to.be.revertedWith('ERC20: burn amount exceeds balance')
      })
    })
  })

  describe('burnFrom', () => {
    function burnFrom (caller: Wallet, tokenOwner: Wallet, amount: BigNumberish) {
      return token.connect(caller).burnFrom(tokenOwner.address, amount)
    }

    const initialBalance = initialSupply
    let tokenOwner: Wallet
    let burner: Wallet

    beforeEach(() => {
      tokenOwner = initialHolder
      burner = secondAccount
    })

    describe('on success', () => {
      describe('for a zero amount', () => {
        shouldBurnFrom(BigNumber.from(0))
      })

      describe('for a non-zero amount', () => {
        shouldBurnFrom(BigNumber.from(12_500_000))
      })

      function shouldBurnFrom (amount: BigNumber) {
        const originalAllowance = amount.mul(3)

        beforeEach(async () => {
          await approve(tokenOwner, burner, originalAllowance)
        })

        it('burns the requested amount', async () => {
          await burnFrom(burner, tokenOwner, amount)
          expect(await token.balanceOf(tokenOwner.address)).to.eq(initialBalance.sub(amount))
          expect(await token.totalSupply()).to.eq(initialSupply.sub(amount))
        })

        it('decrements allowance', async () => {
          await burnFrom(burner, tokenOwner, amount)
          expect(await token.allowance(tokenOwner.address, burner.address)).to.eq(originalAllowance.sub(amount))
        })

        it('emits a transfer event', async () => {
          await expect(burnFrom(burner, tokenOwner, amount))
            .to.emit(token, 'Transfer')
            .withArgs(tokenOwner.address, constants.AddressZero, amount)
        })
      }
    })

    describe('when the given amount is greater than the balance of the sender', () => {
      const amount = initialBalance.add(12_500_000)

      it('reverts', async () => {
        await approve(tokenOwner, burner, amount)
        await expect(burnFrom(burner, tokenOwner, amount))
          .to.be.revertedWith('ERC20: burn amount exceeds balance')
      })
    })

    describe('when the given amount is greater than the allowance', () => {
      const allowance = BigNumber.from(12_500_000)

      it('reverts', async () => {
        await approve(tokenOwner, burner, allowance)
        await expect(burnFrom(burner, tokenOwner, allowance.mul(2)))
          .to.be.revertedWith('ERC20Burnable: burn amount exceeds allowance')
      })
    })
  })
})
