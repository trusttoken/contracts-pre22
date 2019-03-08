const TrueAUD = artifacts.require("TrueAUD")
const TrueCAD = artifacts.require("TrueCAD")
const TrueGBP = artifacts.require("TrueGBP")
const TrueUSD = artifacts.require("TrueUSD")


contract("TrueCurrencies", function(accounts) {
    beforeEach(async function() {
        this.tusd = await TrueUSD.new()
        this.taud = await TrueAUD.new()
        this.tgbp = await TrueGBP.new()
        this.tcad = await TrueCAD.new()
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
            futures.push(nameSymbolDecimalsRounding(this.tusd, "TrueUSD", "TUSD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.taud, "TrueAUD", "TAUD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.tcad, "TrueCAD", "TCAD", 18, 2))
            futures.push(nameSymbolDecimalsRounding(this.tgbp, "TrueGBP", "TGBP", 18, 2))
            await Promise.all(futures)
        })
    })
})
