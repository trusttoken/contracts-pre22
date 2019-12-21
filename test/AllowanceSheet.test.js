import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
const AllowanceSheet = artifacts.require('AllowanceSheet')

const BN = web3.utils.toBN;

contract('AllowanceSheet', function ([_, owner, account2, account3]) {
    beforeEach(async function () {
        this.sheet = await AllowanceSheet.new({ from: owner })
        await this.sheet.addAllowance(account2, account3, BN(100*10**18), { from: owner })
    })

    describe('when the sender is the owner', function () {
        const from = owner

        it('addAllowance', async function () {
            await this.sheet.addAllowance(account2, account3, BN(70*10**18), { from })
            const balance = await this.sheet.allowanceOf.call(account2, account3)
            assert(balance.eq(BN((100+70)*10**18)))
        })

        it('subAllowance', async function () {
            await this.sheet.subAllowance(account2, account3, BN(70*10**18), { from })
            const balance = await this.sheet.allowanceOf.call(account2, account3)
            assert(balance.eq(BN((100-70)*10**18)))
        })

        it('setAllowance', async function () {
            await this.sheet.setAllowance(account2, account3, BN(70*10**18), { from })
            const balance = await this.sheet.allowanceOf.call(account2, account3)
            assert(balance.eq(BN(70*10**18)))
        })

        it('reverts subAllowance if insufficient funds', async function () {
            await expectThrow(this.sheet.subAllowance(account2, account3, BN(170*10**18), { from }))
        })
    })

    describe('when the sender is not the owner', function () {
        const from = account2
        it('reverts all calls', async function () {
            await assertRevert(this.sheet.addAllowance(account2, account3, BN(70*10**18), { from }))
            await assertRevert(this.sheet.subAllowance(account2, account3, BN(70*10**18), { from }))
            await assertRevert(this.sheet.setAllowance(account2, account3, BN(70*10**18), { from }))
        })
    })
})
