import redeemTokenTests from './RedeemToken';

const Registry = artifacts.require("RegistryMock")
const TrueUSD = artifacts.require("TrueUSDMock")
const AllowanceSheet = artifacts.require("AllowanceSheet")
const ForceEther = artifacts.require("ForceEther")

contract('RedeemToken', function (accounts) {
    const [_, owner, oneHundred, anotherAccount] = accounts
    beforeEach(async function () {
        this.registry = await Registry.new({ from: owner })
        this.token = await TrueUSD.new(owner, 0, { from: owner })
        await this.token.setRegistry(this.registry.address, { from: owner })
        await this.token.setBurnBounds(BN(5*10**18), BN(1000).mul(BN(10**18)), { from: owner }) 
        await this.registry.subscribe(CAN_BURN, this.token.address, { from: owner })
        await this.token.mint(oneHundred, BN(100).mul(BN(10**18)), { from: owner })
    })
    redeemTokenTests([owner, oneHundred, anotherAccount])
})
