import { BigNumber, BigNumberish, constants, providers, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { initialSupply, setupTrueGold } from 'fixtures/trueGold'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueGold } from 'contracts'

describe('TrueGold - TrueMintableBurnable', () => {
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

  describe('transfers to redemption addresses', () => {
    const initialBalance = initialSupply
    let tokenOwner: Wallet
    let burner: Wallet

    beforeEach(async () => {
      tokenOwner = initialHolder
      burner = secondAccount
    })

    describe('transfer', () => {
      function transfer (sender: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
        return token.connect(sender).transfer(toAddress(recipient), amount)
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
            await transfer(tokenOwner, redemptionAddress, amount)
            expect(await token.balanceOf(tokenOwner.address)).to.eq(initialBalance.sub(amount))
            expect(await token.totalSupply()).to.eq(initialBalance.sub(amount))
          })

          it('emits transfer and burn events', async () => {
            await expect(transfer(tokenOwner, redemptionAddress, amount))
              .to.emit(token, 'Transfer').withArgs(tokenOwner.address, redemptionAddress, amount).and
              .to.emit(token, 'Transfer').withArgs(redemptionAddress, constants.AddressZero, amount).and
              .to.emit(token, 'Burn').withArgs(redemptionAddress, amount)
          })
        }
      })

      describe('when the given amount is greater than the balance of the sender', () => {
        it('reverts', async () => {
          await expect(transfer(tokenOwner, redemptionAddress, initialBalance.add(12_500_000)))
            .to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })
    })

    describe('transferFrom', () => {
      function transferFrom (spender: Wallet, tokenOwner: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
        return token.connect(spender).transferFrom(toAddress(tokenOwner), toAddress(recipient), amount)
      }

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
            await transferFrom(burner, tokenOwner, redemptionAddress, amount)
            expect(await token.balanceOf(tokenOwner.address)).to.eq(initialBalance.sub(amount))
            expect(await token.totalSupply()).to.eq(initialBalance.sub(amount))
          })

          it('decrements allowance', async () => {
            await transferFrom(burner, tokenOwner, redemptionAddress, amount)
            expect(await token.allowance(tokenOwner.address, burner.address)).to.eq(originalAllowance.sub(amount))
          })

          it('emits transfer and burn events', async () => {
            await expect(transferFrom(burner, tokenOwner, redemptionAddress, amount))
              .to.emit(token, 'Transfer').withArgs(tokenOwner.address, redemptionAddress, amount).and
              .to.emit(token, 'Transfer').withArgs(redemptionAddress, constants.AddressZero, amount).and
              .to.emit(token, 'Burn').withArgs(redemptionAddress, amount)
          })
        }
      })

      describe('when the given amount is greater than the balance of the sender', () => {
        const amount = initialBalance.add(12_500_000)

        it('reverts', async () => {
          await approve(tokenOwner, burner, amount)
          await expect(transferFrom(burner, tokenOwner, redemptionAddress, amount))
            .to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('when the given amount is greater than the allowance', () => {
        const allowance = BigNumber.from(12_500_000)

        it('reverts', async () => {
          await approve(tokenOwner, burner, allowance)
          await expect(transferFrom(burner, tokenOwner, redemptionAddress, allowance.mul(2)))
            .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
        })
      })
    })
  })

  describe('burn bounds', () => {
    const initialBalance = initialSupply
    let tokenOwner: Wallet
    let burner: Wallet

    beforeEach(async () => {
      tokenOwner = initialHolder
      burner = secondAccount
      await token.setBurnBounds(25_000_000, 37_500_000)
    })

    function shouldRespectBurnBounds (burn: (amount: BigNumberish) => Promise<providers.TransactionResponse>) {
      describe('when the burn amount is below min bound', () => {
        it('reverts', async () => {
          await expect(burn(12_500_000)).to.be.revertedWith('TrueMintableBurnable: burn amount below min bound')
        })
      })

      describe('when the burn amount is above max bound', () => {
        it('reverts', async () => {
          await expect(burn(50_000_000)).to.be.revertedWith('TrueMintableBurnable: burn amount exceeds max bound')
        })
      })

      describe('when the burn amount is within bounds', () => {
        it('burns the requested amount', async () => {
          await burn(25_000_000)
          expect(await token.balanceOf(tokenOwner.address)).to.eq(initialBalance.sub(25_000_000))
          expect(await token.totalSupply()).to.eq(initialSupply.sub(25_000_000))
        })
      })
    }

    describe('burn', () => {
      shouldRespectBurnBounds(amount => token.connect(tokenOwner).burn(amount))
    })

    describe('burnFrom', () => {
      beforeEach(async () => {
        await approve(tokenOwner, burner, 50_000_000)
      })

      shouldRespectBurnBounds(amount => token.connect(burner).burnFrom(tokenOwner.address, amount))
    })

    describe('transfer', () => {
      shouldRespectBurnBounds(amount => token.connect(tokenOwner).transfer(redemptionAddress, amount))
    })

    describe('transferFrom', () => {
      beforeEach(async () => {
        await approve(tokenOwner, burner, 50_000_000)
      })

      shouldRespectBurnBounds(amount =>
        token.connect(burner).transferFrom(tokenOwner.address, redemptionAddress, amount))
    })
  })

  describe('setBurnBounds', () => {
    function setBurnBounds (caller: Wallet, minAmount: BigNumberish, maxAmount: BigNumberish) {
      return token.connect(caller).setBurnBounds(minAmount, maxAmount)
    }

    let owner: Wallet
    let other: Wallet

    beforeEach(() => {
      owner = deployer
      other = secondAccount
    })

    describe('when the caller is the contract owner', () => {
      describe('when min amount is less or equal to max amount', () => {
        it('sets the new burn bounds', async () => {
          await setBurnBounds(owner, 12_500_000, 25_000_000)
          expect(await token.burnMin()).to.eq(12_500_000)
          expect(await token.burnMax()).to.eq(25_000_000)
        })

        it('emits set event', async () => {
          await expect(setBurnBounds(owner, 12_500_000, 25_000_000))
            .to.emit(token, 'SetBurnBounds').withArgs(12_500_000, 25_000_000)
        })
      })

      describe('when min amount is greater than max amount', () => {
        it('reverts', async () => {
          await expect(setBurnBounds(owner, 25_000_000, 0))
            .to.be.revertedWith('TrueMintableBurnable: min is greater then max')
        })
      })
    })

    describe('when the caller is not the contract owner', () => {
      it('reverts', async () => {
        await expect(setBurnBounds(other, 0, 25_000_000))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('mint', () => {
    function mint (caller: Wallet, to: WalletOrAddress, amount: BigNumberish) {
      return token.connect(caller).mint(toAddress(to), amount)
    }

    let owner: Wallet
    let other: Wallet

    beforeEach(() => {
      owner = deployer
      other = secondAccount
    })

    describe('when the caller is the contract owner', () => {
      describe('when the target account is not redemption or zero address', () => {
        describe('for a zero amount', () => {
          shouldMint(BigNumber.from(0))
        })

        describe('for a non-zero amount', () => {
          shouldMint(BigNumber.from(100))
        })

        function shouldMint (amount: BigNumber) {
          it('mints the requested amount', async () => {
            const initialSupply = await token.totalSupply()
            const initialBalance = await token.balanceOf(other.address)
            await mint(owner, other, amount)

            expect(await token.totalSupply()).to.eq(initialSupply.add(amount))
            expect(await token.balanceOf(other.address)).to.eq(initialBalance.add(amount))
          })

          it('emits transfer and mint events', async () => {
            await expect(mint(owner, other, amount))
              .to.emit(token, 'Transfer').withArgs(constants.AddressZero, other.address, amount).and
              .to.emit(token, 'Mint').withArgs(other.address, amount)
          })
        }
      })

      describe('when the target account is a redemption address', () => {
        it('reverts', async () => {
          await expect(mint(owner, redemptionAddress, 100))
            .to.be.revertedWith('TrueMintableBurnable: mint to a redemption or zero address')
        })
      })

      describe('when the target account is the zero address', () => {
        it('reverts', async () => {
          await expect(mint(owner, constants.AddressZero, 100))
            .to.be.revertedWith('TrueMintableBurnable: mint to a redemption or zero address')
        })
      })
    })

    describe('when the caller in not the contract owner', () => {
      it('reverts', async () => {
        await expect(mint(other, other, 100))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })
})
