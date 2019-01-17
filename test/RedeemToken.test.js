import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
import assertBalance from './helpers/assertBalance'

const Registry = artifacts.require("Registry")
const TrueUSD = artifacts.require("TrueUSDMock")
const BalanceSheet = artifacts.require("BalanceSheet")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")

contract('RedeemToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount, cannotBurn] = accounts
    const notes = "some notes"
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

    describe('--Redeemable Token--', function () {
        beforeEach(async function () {
            this.registry = await Registry.new({ from: owner })
            this.balances = await BalanceSheet.new({ from: owner })
            this.allowances = await AllowanceSheet.new({ from: owner })
            this.token = await TrueUSD.new(owner, 0, { from: owner })
            await this.token.setRegistry(this.registry.address, { from: owner })
            await this.balances.transferOwnership(this.token.address, { from: owner })
            await this.allowances.transferOwnership(this.token.address, { from: owner })
            await this.token.setBalanceSheet(this.balances.address, { from: owner })
            await this.token.setAllowanceSheet(this.allowances.address, { from: owner })

            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 1, notes, { from: owner })
            await this.token.mint(oneHundred, 100*10**18, { from: owner })
            await this.registry.setAttribute(oneHundred, "hasPassedKYC/AML", 0, notes, { from: owner })

            await this.registry.setAttribute(oneHundred, "canBurn", 1, notes, { from: owner })
            await this.token.setBurnBounds(5*10**18, 1000*10**18, { from: owner }) 
        })

        it('transfer to 0x0 does not burn trueUSD', async function(){
            await assertBalance(this.token, oneHundred, 100*10**18)
            await assertRevert(this.token.transfer(ZERO_ADDRESS, 10*10**18, {from : oneHundred}))
            await assertBalance(this.token, oneHundred, 100*10**18)
            await this.token.approve(anotherAccount, 10*10**18, {from : oneHundred})
            await assertRevert(this.token.transferFrom(oneHundred,ZERO_ADDRESS, 10*10**18, {from : anotherAccount}))
            const totalSupply = await this.token.totalSupply.call()
            assert.equal(Number(totalSupply),100*10**18)
            const balanceOfZero = await this.token.balanceOf.call(ZERO_ADDRESS);
            assert.equal(Number(balanceOfZero), 0);
        })
        
        describe('--Redemption Addresses--', function () {
            const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
            const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'

            it('transfers to Redemption addresses gets burned', async function(){
                await this.registry.setAttribute(ADDRESS_ONE, "canBurn", 1, notes, { from: owner })
                await this.registry.setAttribute(ADDRESS_TWO, "canBurn", 1, notes, { from: owner })
                const {logs} = await this.token.transfer(ADDRESS_ONE, 10*10**18, {from : oneHundred})
                assert.equal(logs[0].event, 'Transfer')
                assert.equal(logs[1].event, 'Burn')
                assert.equal(logs[2].event, 'Transfer')
                await assertBalance(this.token, oneHundred, 90*10**18)
                assert.equal(Number(await this.token.totalSupply.call()),90*10**18)
                await assertRevert(this.token.transfer('0x0000000000000000000000000000000000000004', 10*10**18, {from: oneHundred}))
                assert.equal(Number(await this.token.totalSupply.call()),90*10**18)
                await this.token.transfer(ADDRESS_TWO, 10*10**18, {from : oneHundred})
                assert.equal(Number(await this.token.totalSupply.call()),80*10**18)
                await this.token.transfer(ADDRESS_ONE, 10*10**18, {from : oneHundred})
                assert.equal(Number(await this.token.totalSupply.call()),70*10**18)
            })

            it('transfers to Redemption addresses fails if Redemption address cannot burn', async function(){
                await assertRevert(this.token.transfer(ADDRESS_ONE, 10*10**18, {from : oneHundred}))
            })
        })
    })
})
