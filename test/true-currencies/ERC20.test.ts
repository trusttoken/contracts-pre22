import { BigNumber, BigNumberish, constants, Wallet } from 'ethers'
import { loadFixture } from 'ethereum-waffle'
import { expect } from 'chai'

import { initialSupply, trueCurrency } from 'fixtures/trueCurrency'
import { toAddress, WalletOrAddress } from 'utils'

import { TrueCurrency } from 'contracts/types/TrueCurrency'

describe('TrueCurrency - ERC20', () => {
  let initialHolder: Wallet
  let secondAccount: Wallet
  let thirdAccount: Wallet
  let token: TrueCurrency

  function approve (tokenOwner: Wallet, spender: WalletOrAddress, amount: BigNumberish) {
    const asTokenOwner = token.connect(tokenOwner)
    return asTokenOwner.approve(toAddress(spender), amount)
  }

  beforeEach(async () => {
    ({ wallets: [initialHolder, secondAccount, thirdAccount], token } = await loadFixture(trueCurrency))
  })

  describe('totalSupply', () => {
    it('returns the total amount of tokens', async () => {
      expect(await token.totalSupply()).to.eq(initialSupply)
    })
  })

  describe('balanceOf', () => {
    describe('when the requested account has no tokens', () => {
      it('returns zero', async () => {
        expect(await token.balanceOf(secondAccount.address)).to.eq(0)
      })
    })

    describe('when the requested account has some tokens', () => {
      it('returns the total amount of tokens', async () => {
        expect(await token.balanceOf(initialHolder.address)).to.eq(initialSupply)
      })
    })
  })

  describe('transfer', () => {
    function transfer (sender: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
      const asSender = token.connect(sender)
      return asSender.transfer(toAddress(recipient), amount)
    }

    describe('when the recipient is not the zero address', () => {
      describe('when the sender does not have enough balance', () => {
        it('reverts', async () => {
          await expect(transfer(secondAccount, thirdAccount, 100))
            .to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('when the sender transfers all balance', () => {
        let from: Wallet
        let to: Wallet
        const amount = initialSupply

        beforeEach(() => {
          from = initialHolder
          to = secondAccount
        })

        it('transfers the requested amount', async () => {
          await transfer(from, to, amount)

          expect(await token.balanceOf(from.address)).to.eq(0)
          expect(await token.balanceOf(to.address)).to.eq(amount)
        })

        it('emits a transfer event', async () => {
          await expect(transfer(from, to, amount))
            .to.emit(token, 'Transfer')
            .withArgs(from.address, to.address, amount)
        })
      })

      describe('when the sender transfers zero tokens', () => {
        let from: Wallet
        let to: Wallet
        const amount = 0

        beforeEach(() => {
          from = initialHolder
          to = secondAccount
        })

        it('transfers the requested amount', async () => {
          await transfer(from, to, amount)

          expect(await token.balanceOf(from.address)).to.eq(initialSupply)
          expect(await token.balanceOf(to.address)).to.eq(0)
        })

        it('emits a transfer event', async () => {
          await expect(transfer(from, to, amount))
            .to.emit(token, 'Transfer')
            .withArgs(from.address, to.address, amount)
        })
      })
    })

    describe('when the recipient is the zero address', () => {
      it('reverts', async () => {
        await expect(transfer(initialHolder, constants.AddressZero, initialSupply))
          .to.be.revertedWith('ERC20: transfer to the zero address')
      })
    })
  })

  describe('transferFrom', () => {
    function transferFrom (
      spender: Wallet,
      tokenOwner: WalletOrAddress,
      recipient: WalletOrAddress,
      amount: BigNumberish,
    ) {
      const asSpender = token.connect(spender)
      return asSpender.transferFrom(toAddress(tokenOwner), toAddress(recipient), amount)
    }

    let spender: Wallet

    beforeEach(() => {
      spender = secondAccount
    })

    describe('when the token owner is not the zero address', () => {
      let tokenOwner: Wallet

      beforeEach(() => {
        tokenOwner = initialHolder
      })

      describe('when the recipient is not the zero address', () => {
        let recipient: Wallet

        beforeEach(() => {
          recipient = thirdAccount
        })

        describe('when the spender has enough approved balance', () => {
          beforeEach(async () => {
            await approve(tokenOwner, spender, initialSupply)
          })

          describe('when the token owner has enough balance', () => {
            const amount = initialSupply

            it('transfers the requested amount', async () => {
              try {
                await transferFrom(spender, tokenOwner, recipient, amount)
              } catch (e) {
                console.log(e)
              }

              expect(await token.balanceOf(tokenOwner.address)).to.eq(0)
              expect(await token.balanceOf(recipient.address)).to.eq(amount)
            })

            it('decreases the spender allowance', async () => {
              await transferFrom(spender, tokenOwner, recipient, amount)

              expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(0)
            })

            it('emits a transfer event', async () => {
              await expect(transferFrom(spender, tokenOwner, recipient, amount))
                .to.emit(token, 'Transfer')
                .withArgs(tokenOwner.address, recipient.address, amount)
            })

            it('emits an approval event', async () => {
              await expect(transferFrom(spender, tokenOwner, recipient, amount))
                .to.emit(token, 'Approval')
                .withArgs(tokenOwner.address, spender.address, 0)
            })
          })

          describe('when the token owner does not have enough balance', () => {
            const amount = initialSupply.add(1)

            it('reverts', async () => {
              await expect(transferFrom(spender, tokenOwner, recipient, amount))
                .to.be.revertedWith('ERC20: transfer amount exceeds balance')
            })
          })
        })

        describe('when the spender does not have enough approved balance', () => {
          beforeEach(async () => {
            await approve(tokenOwner, spender, initialSupply.sub(1))
          })

          describe('when the token owner has enough balance', () => {
            const amount = initialSupply

            it('reverts', async () => {
              await expect(transferFrom(spender, tokenOwner, recipient, amount))
                .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })

          describe('when the token owner does not have enough balance', () => {
            const amount = initialSupply.add(1)

            it('reverts', async () => {
              await expect(transferFrom(spender, tokenOwner, recipient, amount))
                .to.be.revertedWith('ERC20: transfer amount exceeds balance')
            })
          })
        })
      })

      describe('when the recipient is the zero address', () => {
        const recipient = constants.AddressZero
        const amount = initialSupply

        beforeEach(async () => {
          await approve(tokenOwner, spender, amount)
        })

        it('reverts', async () => {
          await expect(transferFrom(spender, tokenOwner, recipient, amount))
            .to.be.revertedWith('ERC20: transfer to the zero address')
        })
      })
    })

    describe('when the token owner is the zero address', () => {
      const tokenOwner = constants.AddressZero

      it('reverts', async () => {
        await expect(transferFrom(spender, tokenOwner, thirdAccount, 0))
          .to.be.revertedWith('ERC20: transfer from the zero address')
      })
    })
  })

  describe('approve', () => {
    let tokenOwner: Wallet

    beforeEach(() => {
      tokenOwner = initialHolder
    })

    describe('when the spender is not the zero address', () => {
      let spender: Wallet

      beforeEach(() => {
        spender = secondAccount
      })

      function describeApprove (description: string, amount: BigNumberish) {
        describe(description, () => {
          it('emits an approval event', async () => {
            await expect(approve(tokenOwner, spender, amount))
              .to.emit(token, 'Approval')
              .withArgs(tokenOwner.address, spender.address, amount)
          })

          describe('when there was no approved amount before', () => {
            it('approves the requested amount', async () => {
              await approve(tokenOwner, spender, amount)
              expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(amount)
            })
          })

          describe('when the spender had an approved amount', () => {
            beforeEach(async () => {
              await approve(tokenOwner, spender, 1)
            })

            it('approves the requested amount and replaces the previous one', async () => {
              await approve(tokenOwner, spender, amount)
              expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(amount)
            })
          })
        })
      }

      describeApprove('when the sender has enough balance', initialSupply)
      describeApprove('when the sender does not have enough balance', initialSupply.add(1))
    })

    describe('when the spender is the zero address', () => {
      const spender = constants.AddressZero

      it('reverts', async () => {
        await expect(approve(tokenOwner, spender, initialSupply))
          .to.be.revertedWith('ERC20: approve to the zero address')
      })
    })
  })

  describe('decreaseAllowance', () => {
    function decreaseAllowance (tokenOwner: Wallet, spender: WalletOrAddress, subtractedValue: BigNumberish) {
      const asTokenOwner = token.connect(tokenOwner)
      return asTokenOwner.decreaseAllowance(toAddress(spender), subtractedValue)
    }

    let tokenOwner: Wallet

    beforeEach(() => {
      tokenOwner = initialHolder
    })

    describe('when the spender is not the zero address', () => {
      let spender: Wallet

      beforeEach(() => {
        spender = secondAccount
      })

      function shouldDecreaseApproval (amount: BigNumber) {
        describe('when there was no approved amount before', () => {
          it('reverts', async () => {
            await expect(decreaseAllowance(tokenOwner, spender, amount))
              .to.be.revertedWith('ERC20: decreased allowance below zero')
          })
        })

        describe('when the spender had an approved amount', () => {
          const approvedAmount = amount

          beforeEach(async () => {
            await approve(tokenOwner, spender, approvedAmount)
          })

          it('emits an approval event', async () => {
            await expect(decreaseAllowance(tokenOwner, spender, approvedAmount))
              .to.emit(token, 'Approval')
              .withArgs(tokenOwner.address, spender.address, 0)
          })

          it('decreases the spender allowance subtracting the requested amount', async () => {
            await decreaseAllowance(tokenOwner, spender, approvedAmount.sub(1))
            expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(1)
          })

          it('sets the allowance to zero when all allowance is removed', async () => {
            await decreaseAllowance(tokenOwner, spender, approvedAmount)
            expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(0)
          })

          it('reverts when more than the full allowance is removed', async () => {
            await expect(decreaseAllowance(tokenOwner, spender, approvedAmount.add(1)))
              .to.be.revertedWith('ERC20: decreased allowance below zero')
          })
        })
      }

      describe('when the sender has enough balance', () => {
        shouldDecreaseApproval(initialSupply)
      })

      describe('when the sender does not have enough balance', () => {
        shouldDecreaseApproval(initialSupply.add(1))
      })
    })

    describe('when the spender is the zero address', () => {
      const spender = constants.AddressZero
      const amount = initialSupply

      it('reverts', async () => {
        await expect(decreaseAllowance(tokenOwner, spender, amount))
          .to.be.revertedWith('ERC20: decreased allowance below zero')
      })
    })
  })

  describe('increaseAllowance', () => {
    function increaseAllowance (tokenOwner: Wallet, spender: WalletOrAddress, addedValue: BigNumberish) {
      const asTokenOwner = token.connect(tokenOwner)
      return asTokenOwner.increaseAllowance(toAddress(spender), addedValue)
    }

    let tokenOwner: Wallet

    beforeEach(() => {
      tokenOwner = initialHolder
    })

    describe('when the spender is not the zero address', () => {
      let spender: Wallet

      beforeEach(() => {
        spender = secondAccount
      })

      function shouldIncreaseApproval (amount: BigNumber) {
        it('emits an approval event', async () => {
          await expect(increaseAllowance(tokenOwner, spender, amount))
            .to.emit(token, 'Approval')
            .withArgs(tokenOwner.address, spender.address, amount)
        })

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await increaseAllowance(tokenOwner, spender, amount)
            expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(amount)
          })
        })

        describe('when the spender had an approved amount', () => {
          beforeEach(async () => {
            await approve(tokenOwner, spender, 1)
          })

          it('increases the spender allowance adding the requested amount', async () => {
            await increaseAllowance(tokenOwner, spender, amount)
            expect(await token.allowance(tokenOwner.address, spender.address)).to.eq(amount.add(1))
          })
        })
      }

      describe('when the sender has enough balance', () => {
        shouldIncreaseApproval(initialSupply)
      })

      describe('when the sender does not have enough balance', () => {
        shouldIncreaseApproval(initialSupply.add(1))
      })
    })

    describe('when the spender is the zero address', () => {
      const spender = constants.AddressZero
      const amount = initialSupply

      it('reverts', async () => {
        await expect(increaseAllowance(tokenOwner, spender, amount))
          .to.be.revertedWith('ERC20: approve to the zero address')
      })
    })
  })
})
