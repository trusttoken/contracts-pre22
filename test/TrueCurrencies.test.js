const TrueAUD = artifacts.require("TrueAUD")
const TrueCAD = artifacts.require("TrueCAD")
const TrueGBP = artifacts.require("TrueGBP")
const TrueUSD = artifacts.require("TrueUSD")
const Registry = artifacts.require("RegistryMock")

const BN = web3.utils.toBN;
const bytes32 = require('./helpers/bytes32.js')

contract("TrueCurrencies", function([owner, oneHundred, anotherAccount]) {
    const DOLLAR = BN(10**18)
    beforeEach(async function() {
        this.TUSD = await TrueUSD.new({from: owner})
        this.TAUD = await TrueAUD.new({from: owner})
        this.TGBP = await TrueGBP.new({from: owner})
        this.TCAD = await TrueCAD.new({from: owner})
        this.registry = await Registry.new({ from: owner })
    })

    async function nameSymbolDecimalsRounding(token, name, symbol, decimals, rounding) {
        assert.equal(name, await token.name.call(),name + ' is named ' + name)
        assert.equal(symbol, await token.symbol.call(), name + ' has symbol ' + symbol)
        assert.equal(decimals, await token.decimals.call(), name + ' has ' + decimals + ' decimals')
        assert.equal(rounding, await token.rounding.call(), name + ' has ' + rounding + ' rounding')
    }
    describe('token info', function() {
        it('differentiates token names and symbols', async function() {
            const futures = []
            futures.push(nameSymbolDecimalsRounding(this.TUSD, "TrueUSD", "TUSD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.TAUD, "TrueAUD", "TAUD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.TCAD, "TrueCAD", "TCAD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.TGBP, "TrueGBP", "TGBP", 18, 2))
            await Promise.all(futures)
        })
    })
    function hasBurnAttribute(token, attribute) {
        describe(attribute, function() {
            beforeEach(async function() {
                const burnAttribute = bytes32(attribute)
                this.token = this[token]
                await this.token.setRegistry(this.registry.address, { from: owner })
                await this.token.setBurnBounds(BN(10**16), BN(100).mul(DOLLAR), { from: owner })
                await this.registry.subscribe(burnAttribute, this.token.address, { from: owner })
                await this.registry.setAttributeValue(oneHundred, burnAttribute, BN(1), { from: owner })
                await this.token.mint(oneHundred, DOLLAR, { from: owner })
            })
            it('can burn', async function() {
                await this.token.burn(DOLLAR, { from: oneHundred })
            })
        })
    }
    describe('unique burn attributes', function() {
        hasBurnAttribute("TUSD", "canBurn")
        hasBurnAttribute("TAUD", "canBurnAUD")
        hasBurnAttribute("TCAD", "canBurnCAD")
        hasBurnAttribute("TGBP", "canBurnGBP")
    })
})
