import { expect, use } from 'chai'
import { constants, providers, BigNumberish, BigNumber, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

import { setupDeploy } from 'scripts/utils'

import {
  beforeEachWithFixture,
  parseTRU,
  timeTravel,
  timeTravelTo,
  toAddress,
  WalletOrAddress,
} from 'utils'

import {
  TrustTokenFactory,
  TrustToken,
} from 'contracts'

use(solidity)

describe('TrustToken', () => {
  let owner: Wallet, timeLockRegistry: Wallet, saftHolder: Wallet, initialHolder: Wallet, secondAccount: Wallet, thirdAccount: Wallet, fourthAccount: Wallet
  let trustToken: TrustToken
  let provider: providers.JsonRpcProvider

  beforeEachWithFixture(async (wallets, _provider) => {
    ([owner, timeLockRegistry, saftHolder, initialHolder, secondAccount, thirdAccount, fourthAccount] = wallets)
    provider = _provider
    const deployContract = setupDeploy(owner)
    trustToken = await deployContract(TrustTokenFactory)
    await trustToken.initialize()
    await trustToken.mint(timeLockRegistry.address, parseTRU(1000))
    await trustToken.mint(initialHolder.address, parseTRU(1000))
    await trustToken.setTimeLockRegistry(timeLockRegistry.address)
  })

  describe('ERC20 - standard', () => {
    function approve (tokenOwner: Wallet, spender: WalletOrAddress, amount: BigNumberish) {
      const asTokenOwner = trustToken.connect(tokenOwner)
      return asTokenOwner.approve(toAddress(spender), amount)
    }

    describe('name', () => {
      it('token returns correct name', async () => {
        expect(await trustToken.name()).to.eq('TrueFi')
      })
    })

    describe('totalSupply', () => {
      it('returns the total amount of tokens', async () => {
        expect(await trustToken.totalSupply()).to.eq(parseTRU(2000))
      })
    })

    describe('balanceOf', () => {
      describe('when the requested account has no tokens', () => {
        it('returns zero', async () => {
          expect(await trustToken.balanceOf(secondAccount.address)).to.eq(0)
        })
      })

      describe('when the requested account has some tokens', () => {
        it('returns the total amount of tokens', async () => {
          expect(await trustToken.balanceOf(initialHolder.address)).to.eq(parseTRU(1000))
        })
      })
    })

    describe('transfer', () => {
      function transfer (sender: Wallet, recipient: WalletOrAddress, amount: BigNumberish) {
        const asSender = trustToken.connect(sender)
        return asSender.transfer(toAddress(recipient), amount)
      }

      describe('when the recipient is not the zero address', () => {
        describe('when the sender does not have enough balance', () => {
          it('reverts', async () => {
            await expect(transfer(secondAccount, thirdAccount, 100))
              .to.be.revertedWith('insufficient balance')
          })
        })

        describe('when the sender transfers all balance', () => {
          let from: Wallet
          let to: Wallet
          const amount = parseTRU(1000)

          beforeEach(() => {
            from = initialHolder
            to = secondAccount
          })

          it('transfers the requested amount', async () => {
            await transfer(from, to, amount)

            expect(await trustToken.balanceOf(from.address)).to.eq(0)
            expect(await trustToken.balanceOf(to.address)).to.eq(amount)
          })

          it('emits a transfer event', async () => {
            await expect(transfer(from, to, amount))
              .to.emit(trustToken, 'Transfer')
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

            expect(await trustToken.balanceOf(from.address)).to.eq(parseTRU(1000))
            expect(await trustToken.balanceOf(to.address)).to.eq(0)
          })

          it('emits a transfer event', async () => {
            await expect(transfer(from, to, amount))
              .to.emit(trustToken, 'Transfer')
              .withArgs(from.address, to.address, amount)
          })
        })
      })

      describe('when the recipient is the zero address', () => {
        it('reverts', async () => {
          await expect(transfer(initialHolder, constants.AddressZero, parseTRU(2000)))
            .to.be.revertedWith('insufficient balance')
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
        const asSpender = trustToken.connect(spender)
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
              await approve(tokenOwner, spender, parseTRU(1000))
            })

            describe('when the token owner has enough balance', () => {
              const amount = parseTRU(1000)

              it('transfers the requested amount', async () => {
                try {
                  await transferFrom(spender, tokenOwner, recipient, amount)
                } catch (e) {
                  console.log(e)
                }

                expect(await trustToken.balanceOf(tokenOwner.address)).to.eq(0)
                expect(await trustToken.balanceOf(recipient.address)).to.eq(amount)
              })

              it('decreases the spender allowance', async () => {
                await transferFrom(spender, tokenOwner, recipient, amount)

                expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(0)
              })

              it('emits a transfer event', async () => {
                await expect(transferFrom(spender, tokenOwner, recipient, amount))
                  .to.emit(trustToken, 'Transfer')
                  .withArgs(tokenOwner.address, recipient.address, amount)
              })

              it('emits an approval event', async () => {
                await expect(transferFrom(spender, tokenOwner, recipient, amount))
                  .to.emit(trustToken, 'Approval')
                  .withArgs(tokenOwner.address, spender.address, 0)
              })
            })

            describe('when the token owner does not have enough balance', () => {
              const amount = parseTRU(1000).add(1)

              it('reverts', async () => {
                await expect(transferFrom(spender, tokenOwner, recipient, amount))
                  .to.be.revertedWith('insufficient balance')
              })
            })
          })

          describe('when the spender does not have enough approved balance', () => {
            beforeEach(async () => {
              await approve(tokenOwner, spender, parseTRU(1000).sub(1))
            })

            describe('when the token owner has enough balance', () => {
              const amount = parseTRU(1000)

              it('reverts', async () => {
                await expect(transferFrom(spender, tokenOwner, recipient, amount))
                  .to.be.revertedWith('ERC20: transfer amount exceeds allowance')
              })
            })

            describe('when the token owner does not have enough balance', () => {
              const amount = parseTRU(1000).add(1)

              it('reverts', async () => {
                await expect(transferFrom(spender, tokenOwner, recipient, amount))
                  .to.be.revertedWith('insufficient balance')
              })
            })
          })
        })

        describe('when the recipient is the zero address', () => {
          const recipient = constants.AddressZero
          const amount = parseTRU(1000)

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
                .to.emit(trustToken, 'Approval')
                .withArgs(tokenOwner.address, spender.address, amount)
            })

            describe('when there was no approved amount before', () => {
              it('approves the requested amount', async () => {
                await approve(tokenOwner, spender, amount)
                expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(amount)
              })
            })

            describe('when the spender had an approved amount', () => {
              beforeEach(async () => {
                await approve(tokenOwner, spender, 1)
              })

              it('approves the requested amount and replaces the previous one', async () => {
                await approve(tokenOwner, spender, amount)
                expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(amount)
              })
            })
          })
        }

        describeApprove('when the sender has enough balance', parseTRU(1000))
        describeApprove('when the sender does not have enough balance', parseTRU(1000).add(1))
      })

      describe('when the spender is the zero address', () => {
        const spender = constants.AddressZero

        it('reverts', async () => {
          await expect(approve(tokenOwner, spender, parseTRU(1000)))
            .to.be.revertedWith('ERC20: approve to the zero address')
        })
      })
    })

    describe('decreaseAllowance', () => {
      function decreaseAllowance (tokenOwner: Wallet, spender: WalletOrAddress, subtractedValue: BigNumberish) {
        const asTokenOwner = trustToken.connect(tokenOwner)
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
                .to.emit(trustToken, 'Approval')
                .withArgs(tokenOwner.address, spender.address, 0)
            })

            it('decreases the spender allowance subtracting the requested amount', async () => {
              await decreaseAllowance(tokenOwner, spender, approvedAmount.sub(1))
              expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(1)
            })

            it('sets the allowance to zero when all allowance is removed', async () => {
              await decreaseAllowance(tokenOwner, spender, approvedAmount)
              expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(0)
            })

            it('reverts when more than the full allowance is removed', async () => {
              await expect(decreaseAllowance(tokenOwner, spender, approvedAmount.add(1)))
                .to.be.revertedWith('ERC20: decreased allowance below zero')
            })
          })
        }

        describe('when the sender has enough balance', () => {
          shouldDecreaseApproval(parseTRU(1000))
        })

        describe('when the sender does not have enough balance', () => {
          shouldDecreaseApproval(parseTRU(1000).add(1))
        })
      })

      describe('when the spender is the zero address', () => {
        const spender = constants.AddressZero
        const amount = parseTRU(1000)

        it('reverts', async () => {
          await expect(decreaseAllowance(tokenOwner, spender, amount))
            .to.be.revertedWith('ERC20: decreased allowance below zero')
        })
      })
    })

    describe('increaseAllowance', () => {
      function increaseAllowance (tokenOwner: Wallet, spender: WalletOrAddress, addedValue: BigNumberish) {
        const asTokenOwner = trustToken.connect(tokenOwner)
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
              .to.emit(trustToken, 'Approval')
              .withArgs(tokenOwner.address, spender.address, amount)
          })

          describe('when there was no approved amount before', () => {
            it('approves the requested amount', async () => {
              await increaseAllowance(tokenOwner, spender, amount)
              expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(amount)
            })
          })

          describe('when the spender had an approved amount', () => {
            beforeEach(async () => {
              await approve(tokenOwner, spender, 1)
            })

            it('increases the spender allowance adding the requested amount', async () => {
              await increaseAllowance(tokenOwner, spender, amount)
              expect(await trustToken.allowance(tokenOwner.address, spender.address)).to.eq(amount.add(1))
            })
          })
        }

        describe('when the sender has enough balance', () => {
          shouldIncreaseApproval(parseTRU(1000))
        })

        describe('when the sender does not have enough balance', () => {
          shouldIncreaseApproval(parseTRU(1000).add(1))
        })
      })

      describe('when the spender is the zero address', () => {
        const spender = constants.AddressZero
        const amount = parseTRU(1000)

        it('reverts', async () => {
          await expect(increaseAllowance(tokenOwner, spender, amount))
            .to.be.revertedWith('ERC20: approve to the zero address')
        })
      })
    })

    describe('burn', () => {
      describe('when trying to burn not more than own balance', () => {
        beforeEach(async () => {
          await trustToken.mint(secondAccount.address, parseTRU(10))
          expect(await trustToken.balanceOf(secondAccount.address)).to.equal(parseTRU(10))
          await trustToken.connect(secondAccount).burn(parseTRU(10))
          await trustToken.connect(initialHolder).burn(parseTRU(10))
        })

        it('reduces balance', async () => {
          expect(await trustToken.balanceOf(secondAccount.address)).to.equal(0)
          expect(await trustToken.balanceOf(initialHolder.address)).to.equal(parseTRU(990))
        })

        it('reduces total supply', async () => {
          expect(await trustToken.totalSupply()).to.equal(parseTRU(1990))
        })
      })

      describe('when trying to burn more than own balance', () => {
        it('reverts', async () => {
          await expect(trustToken.connect(initialHolder).burn(parseTRU(1001)))
            .to.be.revertedWith('insufficient balance')
        })
      })
    })
  })

  it('only owner can set timeLockRegistry address', async () => {
    await expect(trustToken.connect(timeLockRegistry).setTimeLockRegistry(timeLockRegistry.address)).to.be.revertedWith('only owner')
  })

  describe('TimeLock', () => {
    const DAY = 24 * 3600
    const TOTAL_LOCK_TIME = DAY * (120 + 7 * 90)
    const initializationTimestamp = 1595609911

    beforeEach(async () => {
      await timeTravelTo(provider, initializationTimestamp)
      await trustToken.connect(timeLockRegistry).registerLockup(saftHolder.address, parseTRU(100))
    })

    it('correctly setups epoch start', async () => {
      expect(await trustToken.lockStart()).to.equal(initializationTimestamp)
      expect(await trustToken.epochsPassed()).to.equal(0)
      expect(await trustToken.latestEpoch(), 'latest epoch').to.equal(initializationTimestamp)
      expect(await trustToken.nextEpoch(), 'next epoch').to.equal(initializationTimestamp + DAY * 120)
      expect(await trustToken.finalEpoch(), 'final epoch').to.equal(initializationTimestamp + TOTAL_LOCK_TIME)
    })

    ;[
      [120, 1],
      [150, 1],
      [209, 1],
      [210, 2],
      [299, 2],
      [300, 3],
      [389, 3],
      [390, 4],
      [479, 4],
      [480, 5],
      [569, 5],
      [570, 6],
      [659, 6],
      [660, 7],
      [749, 7],
    ].forEach(([days, expectedEpochsPassed]) => {
      it(`counts ${expectedEpochsPassed} epochs as passed after ${days} days`, async () => {
        await timeTravel(provider, DAY * days)
        const expectedLatestEpoch = initializationTimestamp + (120 + (expectedEpochsPassed - 1) * 90) * DAY

        expect(await trustToken.epochsPassed()).to.equal(expectedEpochsPassed)
        expect(await trustToken.latestEpoch()).to.equal(expectedLatestEpoch)
        expect(await trustToken.nextEpoch()).to.equal(expectedLatestEpoch + 90 * DAY)
      })
    })

    it('counts 8 epochs as passed after 750 days', async () => {
      await timeTravel(provider, DAY * 750)
      const expectedLatestEpoch = initializationTimestamp + (120 + (8 - 1) * 90) * DAY

      expect(await trustToken.epochsPassed()).to.equal(8)
      expect(await trustToken.latestEpoch()).to.equal(expectedLatestEpoch)
      expect(await trustToken.nextEpoch()).to.equal(constants.MaxUint256)
    })

    it('counts 8 epochs as passed after 7501 days', async () => {
      await timeTravel(provider, DAY * 7501)
      const expectedLatestEpoch = initializationTimestamp + (120 + (8 - 1) * 90) * DAY

      expect(await trustToken.epochsPassed()).to.equal(8)
      expect(await trustToken.latestEpoch()).to.equal(expectedLatestEpoch)
      expect(await trustToken.nextEpoch()).to.equal(constants.MaxUint256)
    })

    it('does not unlock funds until epoch passes', async () => {
      await timeTravel(provider, DAY * 119)

      expect(await trustToken.epochsPassed()).to.equal(0)
      expect(await trustToken.latestEpoch()).to.equal(initializationTimestamp)
      expect(await trustToken.nextEpoch()).to.equal(initializationTimestamp + DAY * 120)
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100))
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(0)
    })

    it('unlocks 1/8 of locked funds after epoch passes', async () => {
      await timeTravel(provider, DAY * 120)

      expect(await trustToken.epochsPassed()).to.equal(1)
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))

      await timeTravel(provider, DAY * 90)

      expect(await trustToken.epochsPassed()).to.equal(2)
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(2))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(6))
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
    })

    it('unlocks all funds after total lock time passes', async () => {
      await timeTravel(provider, TOTAL_LOCK_TIME)

      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(0)
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))

      await timeTravel(provider, TOTAL_LOCK_TIME * 10)

      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(0)
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
      expect(await trustToken.nextEpoch()).to.equal(constants.MaxUint256)
    })

    it('can lock funds multiple times for one account', async () => {
      await trustToken.connect(timeLockRegistry).registerLockup(saftHolder.address, parseTRU(100))
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(0))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(200))
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(200))
    })

    it('only timeLockRegistry can register lockups', async () => {
      await expect(trustToken.connect(owner).registerLockup(saftHolder.address, parseTRU(100))).to.be.revertedWith('only TimeLockRegistry')
    })

    it('cannot burn locked tokens', async () => {
      await expect(trustToken.connect(saftHolder).burn(10)).to.be.revertedWith('attempting to burn locked funds')
      await timeTravel(provider, DAY * 120)
      await expect(trustToken.connect(saftHolder).burn(parseTRU(100).div(8).add(1))).to.be.revertedWith('attempting to burn locked funds')
      await expect(trustToken.connect(saftHolder).burn(parseTRU(100).div(8))).to.be.not.reverted
    })

    it('works correctly when new lockup is registered not on first block', async () => {
      await timeTravel(provider, DAY * 300) // epoch 3
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(3))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(5))
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
      await trustToken.connect(timeLockRegistry).registerLockup(saftHolder.address, parseTRU(100))
      expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(200).div(8).mul(3))
      expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(200).div(8).mul(5))
      expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(200))
    })

    context('Transfers', () => {
      it('cannot transfer locked funds', async () => {
        await expect(trustToken.connect(saftHolder).transfer(fourthAccount.address, 1)).to.be.revertedWith('attempting to transfer locked funds')
      })

      it('transfers to owner not allowed after returns disabled', async () => {
        await trustToken.connect(owner).lockReturns()
        await expect(trustToken.connect(saftHolder).transfer(fourthAccount.address, 1)).to.be.revertedWith('attempting to transfer locked funds')
      })

      it('transfers to owner allowed - uses locked funds', async () => {
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(0)
        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(100))
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(0)
        expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(0)
        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(0)
        expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(100))
      })

      it('transfers to owner allowed - uses only unlocked funds', async () => {
        await timeTravel(provider, DAY * 120)
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8))

        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(10))
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).sub(parseTRU(10)))
        expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(90))
        expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(10))
      })

      it('transfers to owner allowed - uses unlocked funds before locked', async () => {
        await timeTravel(provider, DAY * 120)
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8))

        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(25))
        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(1)
        expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(4).mul(3).sub(1))
        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(75))
        expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(25))
      })

      it('transfers to owner transfer unlocked funds first', async () => {
        await timeTravel(provider, DAY * 120)
        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(100))
      })

      it('can transfer unlocked funds', async () => {
        await timeTravel(provider, DAY * 120)

        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(100).div(8))

        expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(0)
        expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
      })

      it('cannot transfer more than unlocked funds', async () => {
        await timeTravel(provider, DAY * 120)

        await expect(trustToken.connect(saftHolder).transfer(fourthAccount.address, parseTRU(100).div(8).add(1))).to.be.revertedWith('attempting to transfer locked funds')
      })

      it('if account has received tokens in normal way, they are transferable', async () => {
        await trustToken.connect(timeLockRegistry).transfer(saftHolder.address, parseTRU(10))

        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(110))
        expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100))

        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(10))

        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
        expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(10))
      })

      it('if account has received tokens in normal way, they are transferable after some epochs has passed', async () => {
        await timeTravel(provider, DAY * 220)
        await trustToken.connect(timeLockRegistry).transfer(saftHolder.address, parseTRU(10))

        await trustToken.connect(saftHolder).transfer(owner.address, parseTRU(35))

        expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(75))
        expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(35))

        await expect(trustToken.connect(saftHolder).transfer(fourthAccount.address, 1)).to.be.revertedWith('attempting to transfer locked funds')
      })

      it('cannot transfer more than balance', async () => {
        await expect(trustToken.connect(saftHolder).transfer(owner.address, parseTRU(100).add(1))).to.be.revertedWith('insufficient balance')
      })

      describe('transferFrom', () => {
        beforeEach(async () => {
          await trustToken.connect(saftHolder).approve(timeLockRegistry.address, parseTRU(100))
        })

        it('cannot transfer locked funds', async () => {
          await expect(trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, fourthAccount.address, 1)).to.be.revertedWith('attempting to transfer locked funds')
        })

        it('can transfer unlocked funds', async () => {
          await timeTravel(provider, DAY * 120)
          await trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, owner.address, parseTRU(100).div(8))

          expect(await trustToken.unlockedBalance(saftHolder.address)).to.equal(0)
          expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
          expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100).div(8).mul(7))
        })

        it('cannot transfer more than unlocked funds', async () => {
          await timeTravel(provider, DAY * 120)

          await expect(trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, fourthAccount.address, parseTRU(100).div(8).add(1))).to.be.revertedWith('attempting to transfer locked funds')
        })

        it('if account has received tokens in normal way, they are transferable', async () => {
          await trustToken.connect(timeLockRegistry).transfer(saftHolder.address, parseTRU(10))

          expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(110))
          expect(await trustToken.lockedBalance(saftHolder.address)).to.equal(parseTRU(100))

          await trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, owner.address, parseTRU(10))

          expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(100))
          expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(10))
        })

        it('if account has received tokens in normal way, they are transferable after some epochs has passed', async () => {
          await timeTravel(provider, DAY * 220)
          await trustToken.connect(timeLockRegistry).transfer(saftHolder.address, parseTRU(10))

          await trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, owner.address, parseTRU(35))

          expect(await trustToken.balanceOf(saftHolder.address)).to.equal(parseTRU(75))
          expect(await trustToken.balanceOf(owner.address)).to.equal(parseTRU(35))

          await expect(trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, fourthAccount.address, 1)).to.be.revertedWith('attempting to transfer locked funds')
        })

        it('cannot transfer more than balance', async () => {
          await expect(trustToken.connect(timeLockRegistry).transferFrom(saftHolder.address, owner.address, parseTRU(100).add(1))).to.be.revertedWith('insufficient balance')
        })
      })
    })
  })
})
