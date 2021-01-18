import { constants, Wallet, BigNumber, BigNumberish } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { parseEther } from '@ethersproject/units'
import { AddressZero, Zero } from '@ethersproject/constants'
import { expect } from 'chai'

import { initialSupply, trueCurrency } from 'fixtures/trueCurrency'
import { toAddress, WalletOrAddress } from 'utils'

import { MockTrueCurrency } from 'contracts'

describe('TrueCurrency - Mint/Burn', () => {
  const redemptionAddress = '0x0000000000000000000000000000000000074D72'

  let initialHolder: Wallet
  let secondAccount: Wallet
  let token: MockTrueCurrency

  function approve (tokenOwner: Wallet, spender: WalletOrAddress, amount: BigNumberish) {
    const asTokenOwner = token.connect(tokenOwner)
    return asTokenOwner.approve(toAddress(spender), amount)
  }

  function transfer (sender: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
    return token.connect(sender).transfer(toAddress(recipient), amount)
  }

  function transferFrom (spender: Wallet, tokenOwner: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
    return token.connect(spender).transferFrom(toAddress(tokenOwner), toAddress(recipient), amount)
  }

  beforeEach(async () => {
    ({ wallets: [initialHolder, secondAccount], token } = await loadFixture(trueCurrency))
    await token.setBurnBounds(0, constants.MaxUint256)
    await token.setCanBurn(redemptionAddress, true)
  })

  describe('transfers to redemption addresses', () => {
    const initialBalance = initialSupply
    let tokenOwner: Wallet
    let burner: Wallet

    beforeEach(async () => {
      tokenOwner = initialHolder
      burner = secondAccount
    })

    it('only owner can allow burning', async () => {
      await expect(token.connect(burner).setCanBurn(burner.address, true))
        .to.be.revertedWith('only Owner')
    })

    describe('transfer', () => {
      describe('when the given amount is not greater than balance of the sender', () => {
        describe('for a zero amount', () => {
          shouldBurn(Zero)
        })

        describe('for a non-zero amount', () => {
          shouldBurn(parseEther('12'))
        })

        function shouldBurn (amount: BigNumber) {
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

          it('drops digits below cents', async () => {
            const balanceBefore = await token.balanceOf(tokenOwner.address)
            await expect(transfer(tokenOwner, redemptionAddress, amount.add(12_000)))
              .to.emit(token, 'Transfer').withArgs(tokenOwner.address, redemptionAddress, amount).and
              .to.emit(token, 'Transfer').withArgs(redemptionAddress, constants.AddressZero, amount).and
              .to.emit(token, 'Burn').withArgs(redemptionAddress, amount)
            expect(await token.balanceOf(tokenOwner.address)).to.equal(balanceBefore.sub(amount))
            expect(await token.balanceOf(redemptionAddress)).to.equal(0)
          })
        }
      })

      describe('when the given amount is greater than the balance of the sender', () => {
        it('reverts', async () => {
          await expect(transfer(tokenOwner, redemptionAddress, initialBalance.add(parseEther('0.01'))))
            .to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('when redemption address is not allowed to burn', () => {
        it('reverts', async () => {
          await token.setCanBurn(redemptionAddress, false)
          await expect(transfer(tokenOwner, redemptionAddress, 1))
            .to.be.revertedWith('TrueCurrency: cannot burn from this address')
        })
      })

      it('address(0) is not a redemption address', async () => {
        await expect(transfer(tokenOwner, AddressZero, 1))
          .to.be.revertedWith('ERC20: transfer to the zero address')
      })
    })

    describe('transferFrom', () => {
      describe('on success', () => {
        describe('for a zero amount', () => {
          shouldBurnFrom(BigNumber.from(0))
        })

        describe('for a non-zero amount', () => {
          shouldBurnFrom(parseEther('12'))
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

          it('drops digits below cents', async () => {
            const balanceBefore = await token.balanceOf(tokenOwner.address)
            await approve(tokenOwner, burner, originalAllowance.add(12_000))
            await expect(transferFrom(burner, tokenOwner, redemptionAddress, amount.add(12_000)))
              .to.emit(token, 'Transfer').withArgs(tokenOwner.address, redemptionAddress, amount).and
              .to.emit(token, 'Transfer').withArgs(redemptionAddress, constants.AddressZero, amount).and
              .to.emit(token, 'Burn').withArgs(redemptionAddress, amount)
            expect(await token.balanceOf(redemptionAddress)).to.equal(0)
            expect(await token.balanceOf(tokenOwner.address)).to.equal(balanceBefore.sub(amount))
          })
        }
      })

      describe('when the given amount is greater than the balance of the sender', () => {
        const amount = initialBalance.add(parseEther('0.01'))

        it('reverts', async () => {
          await approve(tokenOwner, burner, amount)
          await expect(transferFrom(burner, tokenOwner, redemptionAddress, amount))
            .to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('when the given amount is greater than the allowance', () => {
        const allowance = BigNumber.from(12_000_000)

        it('reverts', async () => {
          await approve(tokenOwner, burner, allowance)
          await expect(transferFrom(burner, tokenOwner, redemptionAddress, allowance.mul(2)))
            .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
        })
      })

      describe('when redemption address is not allowed to burn', () => {
        it('reverts', async () => {
          await token.setCanBurn(redemptionAddress, false)
          await expect(transferFrom(burner, tokenOwner, redemptionAddress, 1))
            .to.be.revertedWith('TrueCurrency: cannot burn from this address')
        })
      })
    })
  })

  describe('setBurnBounds', () => {
    function setBurnBounds (caller: Wallet, minAmount: BigNumberish, maxAmount: BigNumberish) {
      return token.connect(caller).setBurnBounds(minAmount, maxAmount)
    }

    let owner: Wallet
    let other: Wallet

    beforeEach(() => {
      owner = initialHolder
      other = secondAccount
    })

    describe('when the caller is the contract owner', () => {
      describe('when min amount is less or equal to max amount', () => {
        it('sets the new burn bounds', async () => {
          await setBurnBounds(owner, 10, 100)
          expect(await token.burnMin()).to.eq(10)
          expect(await token.burnMax()).to.eq(100)
        })

        it('emits set event', async () => {
          await expect(setBurnBounds(owner, 10, 100))
            .to.emit(token, 'SetBurnBounds').withArgs(10, 100)
        })
      })

      describe('when min amount is greater than max amount', () => {
        it('reverts', async () => {
          await expect(setBurnBounds(owner, 100, 0))
            .to.be.revertedWith('BurnableTokenWithBounds: min > max')
        })
      })
    })

    describe('when the caller is not the contract owner', () => {
      it('reverts', async () => {
        await expect(setBurnBounds(other, 0, 100))
          .to.be.revertedWith('only Owner')
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
      owner = initialHolder
      other = secondAccount
    })

    describe('when the caller is the contract owner', () => {
      describe('when the target account is not the zero address', () => {
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

      describe('when the target account is the zero address', () => {
        it('reverts', async () => {
          await expect(mint(owner, constants.AddressZero, 100))
            .to.be.revertedWith('ERC20: mint to the zero address')
        })
      })

      describe('when the target account is the redemption address', () => {
        it('reverts', async () => {
          await expect(mint(owner, redemptionAddress, 100))
            .to.be.revertedWith('TrueCurrency: account is a redemption address')
        })
      })
    })

    describe('when the caller in not the contract owner', () => {
      it('reverts', async () => {
        await expect(mint(other, other, 100))
          .to.be.revertedWith('only Owner')
      })
    })
  })

  describe('blacklist', () => {
    let blacklistedAccount: Wallet

    beforeEach(async () => {
      blacklistedAccount = secondAccount
      await token.mint(blacklistedAccount.address, parseEther('1'))
      await approve(blacklistedAccount, initialHolder, parseEther('1'))
      await approve(initialHolder, blacklistedAccount, parseEther('1'))
      await approve(initialHolder, initialHolder, parseEther('1'))
      await token.setBlacklisted(blacklistedAccount.address, true)
    })

    it('emits event when blacklist status changes', async () => {
      await expect(token.setBlacklisted(blacklistedAccount.address, false))
        .to.emit(token, 'Blacklisted').withArgs(blacklistedAccount.address, false)

      await expect(token.setBlacklisted(blacklistedAccount.address, true))
        .to.emit(token, 'Blacklisted').withArgs(blacklistedAccount.address, true)
    })

    describe('transfer', () => {
      it('cannot transfer from blacklisted address', async () => {
        await expect(transfer(blacklistedAccount, initialHolder, 1))
          .to.be.revertedWith('TrueCurrency: sender is blacklisted')
      })

      it('cannot transfer to blacklisted address', async () => {
        await expect(transfer(initialHolder, blacklistedAccount, 1))
          .to.be.revertedWith('TrueCurrency: recipient is blacklisted')
      })
    })

    describe('transferFrom', () => {
      it('cannot transfer from blacklisted address', async () => {
        await expect(transferFrom(initialHolder, blacklistedAccount, initialHolder, 1))
          .to.be.revertedWith('TrueCurrency: sender is blacklisted')
      })

      it('cannot transfer to blacklisted address', async () => {
        await expect(transferFrom(initialHolder, initialHolder, blacklistedAccount, 1))
          .to.be.revertedWith('TrueCurrency: recipient is blacklisted')
      })

      it('blacklisted address cannot call transferFrom', async () => {
        await expect(transferFrom(blacklistedAccount, initialHolder, redemptionAddress, 1))
          .to.be.revertedWith('TrueCurrency: tokens spender is blacklisted')
      })
    })

    it('cannot mint to blacklisted account', async () => {
      await expect(token.mint(blacklistedAccount.address, 1)).to.be.revertedWith('TrueCurrency: account is blacklisted')
    })

    describe('approve', () => {
      it('blacklisted account cannot approve', async () => {
        await expect(approve(blacklistedAccount, initialHolder, 1))
          .to.be.revertedWith('TrueCurrency: tokens owner is blacklisted')
      })

      it('cannot approve to blacklisted account', async () => {
        await expect(approve(initialHolder, blacklistedAccount, 1))
          .to.be.revertedWith('TrueCurrency: tokens spender is blacklisted')
      })

      it('can remove approval for blacklisted account', async () => {
        await expect(approve(initialHolder, blacklistedAccount, 0)).to.be.not.reverted
      })

      it('blacklisted account cannot remove approval', async () => {
        await expect(approve(blacklistedAccount, initialHolder, 0)).to.be.revertedWith('TrueCurrency: tokens owner is blacklisted')
      })
    })

    describe('when non owner tries to change blacklist', () => {
      it('reverts', async () => {
        await expect(token.connect(blacklistedAccount).setBlacklisted(blacklistedAccount.address, false))
          .to.be.revertedWith('only Owner')
      })
    })

    describe('when blacklisting redemption address', () => {
      it('reverts', async () => {
        await expect(token.setBlacklisted(AddressZero, true)).to.be.revertedWith('TrueCurrency: blacklisting of redemption address is not allowed')
      })
    })
  })
})
