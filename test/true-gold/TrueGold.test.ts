import { expect } from 'chai'
import { BigNumberish, providers, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'

import { initialSupply, setupTrueGold } from 'fixtures/trueGold'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueGold } from 'contracts'

describe('TrueGold', () => {
  const redemptionAddress = '0x0000000000000000000000000000000000074D72'

  let deployer: Wallet
  let initialHolder: Wallet
  let secondAccount: Wallet
  let token: TrueGold

  function approve (tokenOwner: Wallet, spender: WalletOrAddress, amount: BigNumberish) {
    const asTokenOwner = token.connect(tokenOwner)
    return asTokenOwner.approve(toAddress(spender), amount)
  }

  beforeEach(async () => {
    ({ deployer, initialHolder, secondAccount, token } = await loadFixture(setupTrueGold))
  })

  describe('has standard token properties', () => {
    it('name', async () => {
      expect(await token.name()).to.eq('TrueGold')
    })

    it('symbol', async () => {
      expect(await token.symbol()).to.eq('TGLD')
    })

    it('decimals', async () => {
      expect(await token.decimals()).to.eq(6)
    })
  })

  describe('burn amount restrictions', () => {
    const initialBalance = initialSupply
    let tokenOwner: Wallet
    let burner: Wallet

    beforeEach(async () => {
      tokenOwner = initialHolder
      burner = secondAccount
    })

    function shouldRespectBurnRestrictions (burn: (amount: BigNumberish) => Promise<providers.TransactionResponse>) {
      describe('when burn amount is not a multiple of 12,500,000', () => {
        function reverts (amount: BigNumberish) {
          it('reverts', async () => {
            await expect(burn(amount)).to.be.revertedWith('TrueGold: burn amount is not a multiple of 12,500,000')
          })
        }

        describe('for 8,000,000 amount', () => {
          reverts(8_000_000)
        })

        describe('for 12,500,001 amount', () => {
          reverts(12_500_001)
        })
      })

      describe('when burn amount is a multiple of 12,500,000', () => {
        function successfullyBurns (amount: BigNumberish) {
          it('burns the requested amount', async () => {
            await burn(amount)
            expect(await token.balanceOf(tokenOwner.address)).to.eq(initialBalance.sub(amount))
            expect(await token.totalSupply()).to.eq(initialSupply.sub(amount))
          })
        }

        describe('for a zero amount', () => {
          successfullyBurns(0)
        })

        describe('for 12,500,000 amount', () => {
          successfullyBurns(12_500_000)
        })

        describe('for 37,500,000 amount', () => {
          successfullyBurns(37_500_000)
        })
      })
    }

    describe('burn', () => {
      shouldRespectBurnRestrictions(amount => token.connect(tokenOwner).burn(amount))
    })

    describe('burnFrom', () => {
      beforeEach(async () => {
        await approve(tokenOwner, burner, 37_500_000)
      })

      shouldRespectBurnRestrictions(amount => token.connect(burner).burnFrom(tokenOwner.address, amount))
    })

    describe('transfer', () => {
      shouldRespectBurnRestrictions(amount => token.connect(tokenOwner).transfer(redemptionAddress, amount))
    })

    describe('transferFrom', () => {
      beforeEach(async () => {
        await approve(tokenOwner, burner, 37_500_000)
      })

      shouldRespectBurnRestrictions(amount =>
        token.connect(burner).transferFrom(tokenOwner.address, redemptionAddress, amount))
    })
  })

  describe('setBurnBounds', () => {
    function setBurnBounds (caller: Wallet, minAmount: BigNumberish, maxAmount: BigNumberish) {
      return token.connect(caller).setBurnBounds(minAmount, maxAmount)
    }

    let owner: Wallet

    beforeEach(() => {
      owner = deployer
    })

    describe('when given bounds are multiples of 12,500,000', () => {
      it('sets the new burn bounds', async () => {
        await setBurnBounds(owner, 12_500_000, 25_000_000)
        expect(await token.burnMin()).to.eq(12_500_000)
        expect(await token.burnMax()).to.eq(25_000_000)
      })
    })

    describe('when min amount is not a multiple of 12,500,000', () => {
      it('reverts', async () => {
        await expect(setBurnBounds(owner, 8_000_000, 12_500_000))
          .to.be.revertedWith('TrueGold: min amount is not a multiple of 12,500,000')
      })
    })

    describe('when max amount is not a multiple of 12,500,000', () => {
      it('reverts', async () => {
        await expect(setBurnBounds(owner, 12_500_000, 20_000_000))
          .to.be.revertedWith('TrueGold: max amount is not a multiple of 12,500,000')
      })
    })
  })
})
