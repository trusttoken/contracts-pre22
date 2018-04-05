import assertRevert from '../helpers/assertRevert';
const MintableToken = artifacts.require('ModularMintableToken');
const BalanceSheet = artifacts.require('BalanceSheet');
const AllowanceSheet = artifacts.require('AllowanceSheet');

contract('Mintable', function ([owner, anotherAccount]) {
  beforeEach(async function () {
    const balanceSheet = await BalanceSheet.new({ from: owner });
    const allowanceSheet = await AllowanceSheet.new({ from: owner });
    this.token = await MintableToken.new({ from: owner });
    await balanceSheet.transferOwnership(this.token.address, { from: owner })
    await this.token.setBalanceSheet(balanceSheet.address, { from: owner });
    await allowanceSheet.transferOwnership(this.token.address, { from: owner })
    await this.token.setAllowanceSheet(allowanceSheet.address, { from: owner });
  });

  describe('mint', function () {
    const amount = 100;

    describe('when the sender is the token owner', function () {
      const from = owner;

        it('mints the requested amount', async function () {
          await this.token.mint(owner, amount, { from });

          const balance = await this.token.balanceOf(owner);
          assert.equal(balance, amount);
        });

        it('emits a mint finished event', async function () {
          const { logs } = await this.token.mint(owner, amount, { from });

          assert.equal(logs.length, 2);
          assert.equal(logs[0].event, 'Mint');
          assert.equal(logs[0].args.to, owner);
          assert.equal(logs[0].args.amount, amount);
          assert.equal(logs[1].event, 'Transfer');
        });
    });

    describe('when the sender is not the token owner', function () {
      const from = anotherAccount;

        it('reverts', async function () {
          await assertRevert(this.token.mint(owner, amount, { from }));
        });
    });
  });
});
