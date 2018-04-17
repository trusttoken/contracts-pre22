import assertRevert from './helpers/assertRevert'
import expectThrow from './helpers/expectThrow'
const AddressValidation = artifacts.require('AddressValidation')

contract('AddressValidation', function ([_, owner, account2, account3]) {
    beforeEach(async function () {
        this.contract = await AddressValidation.new({ from: owner })
    })

    describe('validateKey', function () {
        const testMessage = "0x1234567812345678123456781234567812345678123456781234567812345678"

        it('initially has no message', async function () {
            const message = await this.contract.keyValidations(account2)
            assert.equal(message, 0)
        })

        it('stores message', async function () {
            await this.contract.validateKey(testMessage, { from: account2 })
            const message = await this.contract.keyValidations(account2)
            assert.equal(message, testMessage)
        })

        it('emits an event', async function () {
            const { logs } = await this.contract.validateKey(testMessage, { from: account2 })

            assert.equal(logs.length, 1)
            assert.equal(logs[0].event, 'ValidateKey')
            assert.equal(logs[0].args.account, account2)
            assert.equal(logs[0].args.message, testMessage)
        })
    })
})
