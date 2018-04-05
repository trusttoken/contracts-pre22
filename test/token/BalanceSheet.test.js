import assertRevert from '../helpers/assertRevert';
import expectThrow from '../helpers/expectThrow';
const BalanceSheet = artifacts.require('BalanceSheet');

contract('BalanceSheet', function ([_, owner, anotherAccount]) {
    beforeEach(async function () {
        this.sheet = await BalanceSheet.new({ from: owner });
        await this.sheet.addBalance(anotherAccount, 100, { from: owner });
    });

    describe('when the sender is the owner', function () {
        const from = owner;

        it('addBalance', async function () {
            await this.sheet.addBalance(anotherAccount, 70, { from });
            const balance = await this.sheet.balanceOf(anotherAccount);
            assert.equal(balance, 100+70);
        });

        it('subBalance', async function () {
            await this.sheet.subBalance(anotherAccount, 70, { from });
            const balance = await this.sheet.balanceOf(anotherAccount);
            assert.equal(balance, 100-70);
        });

        it('setBalance', async function () {
            await this.sheet.setBalance(anotherAccount, 70, { from });
            const balance = await this.sheet.balanceOf(anotherAccount);
            assert.equal(balance, 70);
        });

        it('reverts subBalance if insufficient funds', async function () {
            await expectThrow(this.sheet.subBalance(anotherAccount, 170, { from }));
        });
    });

    describe('when the sender is not the owner', function () {
        const from = anotherAccount;
        it('reverts all calls', async function () {
            await assertRevert(this.sheet.addBalance(anotherAccount, 70, { from }));
            await assertRevert(this.sheet.subBalance(anotherAccount, 70, { from }));
            await assertRevert(this.sheet.setBalance(anotherAccount, 70, { from }));
        });
    });
});
