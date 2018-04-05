import assertRevert from '../helpers/assertRevert';
import expectThrow from '../helpers/expectThrow';
const AllowanceSheet = artifacts.require('AllowanceSheet');

contract('AllowanceSheet', function ([_, owner, account2, account3]) {
    beforeEach(async function () {
        this.sheet = await AllowanceSheet.new({ from: owner });
        await this.sheet.addAllowance(account2, account3, 100, { from: owner });
    });

    describe('when the sender is the owner', function () {
        const from = owner;

        it('addAllowance', async function () {
            await this.sheet.addAllowance(account2, account3, 70, { from });
            const balance = await this.sheet.allowanceOf(account2, account3);
            assert.equal(balance, 100+70);
        });

        it('subAllowance', async function () {
            await this.sheet.subAllowance(account2, account3, 70, { from });
            const balance = await this.sheet.allowanceOf(account2, account3);
            assert.equal(balance, 100-70);
        });

        it('setAllowance', async function () {
            await this.sheet.setAllowance(account2, account3, 70, { from });
            const balance = await this.sheet.allowanceOf(account2, account3);
            assert.equal(balance, 70);
        });

        it('reverts subAllowance if insufficient funds', async function () {
            await expectThrow(this.sheet.subAllowance(account2, account3, 170, { from }));
        });
    });

    describe('when the sender is not the owner', function () {
        const from = account2;
        it('reverts all calls', async function () {
            await assertRevert(this.sheet.addAllowance(account2, account3, 70, { from }));
            await assertRevert(this.sheet.subAllowance(account2, account3, 70, { from }));
            await assertRevert(this.sheet.setAllowance(account2, account3, 70, { from }));
        });
    });
});
