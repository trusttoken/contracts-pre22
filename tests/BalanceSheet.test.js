import assertRevert from './helpers/assertRevert'
import assertBalance from './helpers/assertBalance'
import expectThrow from './helpers/expectThrow'
const BalanceSheet = artifacts.require('BalanceSheet')

const BN = web3.utils.toBN;

contract('BalanceSheet', function ([_, owner, anotherAccount]) {
    beforeEach(async function () {
        this.sheet = await BalanceSheet.new({ from: owner })
        await this.sheet.addBalance(anotherAccount, BN(100).mul(BN(10**18)), { from: owner })
    })

    describe('when the sender is the owner', function () {
        const from = owner

        it('addBalance', async function () {
            await this.sheet.addBalance(anotherAccount, BN(70*10**18), { from })
            await assertBalance(this.sheet, anotherAccount, BN(170).mul(BN(10**18)))
        })

        it('subBalance', async function () {
            await this.sheet.subBalance(anotherAccount, BN(70*10**18), { from })
            await assertBalance(this.sheet, anotherAccount, BN(100-70).mul(BN(10**18)))
        })

        it('setBalance', async function () {
            await this.sheet.setBalance(anotherAccount, BN(70).mul(BN(10**18)), { from })
            await assertBalance(this.sheet, anotherAccount, BN(70).mul(BN(10**18)))
        })

        it('reverts subBalance if insufficient funds', async function () {
            await expectThrow(this.sheet.subBalance(anotherAccount, BN(170).mul(BN(10**18)), { from }))
        })
    })

    describe('when the sender is not the owner', function () {
        const from = anotherAccount
        it('reverts all calls', async function () {
            await assertRevert(this.sheet.addBalance(anotherAccount, BN(70*10**18), { from }))
            await assertRevert(this.sheet.subBalance(anotherAccount, BN(70*10**18), { from }))
            await assertRevert(this.sheet.setBalance(anotherAccount, BN(70*10**18), { from }))
        })
    })
})
