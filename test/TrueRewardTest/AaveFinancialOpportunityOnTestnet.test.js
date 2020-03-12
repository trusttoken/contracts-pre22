import assertBalance from "../helpers/assertBalance"

const MintableERC20 = artifacts.require('MintableERC20')
const AaveFinancialOpportunity = artifacts.require('AaveFinancialOpportunity')
const OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy')

const A_TOKEN_ADDRESS = '0xA79383e0d2925527ba5Ec1c1bcaA13c28EE00314'
const LENDING_POOL_ADDRESS = '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c'
const TOKEN_ADDRESS = '0x1c4a937d171752e1313D70fb16Ae2ea02f86303e'

const BN = web3.utils.toBN;
const to18Decimals = value => BN(Math.floor(value*10**10)).mul(BN(10**8))

contract('AaveFinancialOpportunity - testnet', function ([address]) {
  before(async function() {
    console.log('locating token')
    this.token = await MintableERC20.at(TOKEN_ADDRESS)
    console.log('minting token')
    await this.token.mint(to18Decimals(10), { from: address })

    console.log('deploying fin op impl')
    this.financialOpportunityImpl = await AaveFinancialOpportunity.new({ from: address })
    console.log('deploying fin op proxy')
    this.financialOpportunityProxy = await OwnedUpgradeabilityProxy.new({ from: address })
    console.log('locating fin op')
    this.financialOpportunity = await AaveFinancialOpportunity.at(this.financialOpportunityProxy.address)
    console.log('updagrading proxy')
    await this.financialOpportunityProxy.upgradeTo(this.financialOpportunityImpl.address, { from: address })
    console.log('configuring fin op')
    await this.financialOpportunity.configure(A_TOKEN_ADDRESS, LENDING_POOL_ADDRESS, this.token.address, { from: address })
  })

  it('deposit', async function () {
    await this.token.approve(this.financialOpportunity.address, to18Decimals(10), { from: address })
    await this.financialOpportunity.deposit(address, to18Decimals(10), { from: address })

    assertBalance(this.token, address, to18Decimals(0))
    const shares = await this.financialOpportunity.balanceOf(address) 
    assert(shares.gt(0))
  })

  it('withdraw 50%', async function () {
    const shares = await this.financialOpportunity.balanceOf(address) 
    await this.financialOpportunity.withdraw(address, shares.div(2), { from: address })
    assertBalance(this.token, address, to18Decimals(5))
  })

  it('withdraw all', async function () {
    await this.financialOpportunity.withdrawAll(address, { from: address })
    assertBalance(this.token, address, to18Decimals(10))
    assertBalance(this.financialOpportunity, address, to18Decimals(0))
  })
})
