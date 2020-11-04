/**
 * ts-node scripts/deploy_curve_pool.ts "{private_key}" "{network}"
 */
// import { ethers, Wallet } from 'ethers'
// import { CurvePoolFactory } from 'contracts/types/CurvePoolFactory'
// import { ICurvePoolFactory } from 'contracts/types/ICurvePoolFactory'
// import { TrueUsdFactory } from 'contracts/types/TrueUsdFactory'
// import { MockProvider } from 'ethereum-waffle'

// const txnArgs = { gasLimit: 4_500_000, gasPrice: 100_000_000_000 }

// async function deployCurvePool (wallet: Wallet) {
//   const tusdAddress = '0x0000000000085d4780B73119b644AE5ecd22b376'
//   const curveAddress = '0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3'
//   return (await new CurvePoolFactory(wallet).deploy(curveAddress, tusdAddress, wallet.address, txnArgs)).deployed()
// }

// const provider = new MockProvider({
//   ganacheOptions: {
//     fork: 'https://mainnet.infura.io/v3/4851451615244f39b965503cadbb0fef@11086706',
//   },
// })

// async function runTest () {
//   const [wallet] = provider.getWallets()
//   const pool = await deployCurvePool(wallet)
//   const tusd = TrueUsdFactory.connect('0x0000000000085d4780B73119b644AE5ecd22b376', wallet)
//   const curvePool = ICurvePoolFactory.connect(await pool.curvePool(), wallet)
//   await tusd.approve(pool.address, '100000000000000000')
//   const balance0 = await tusd.balanceOf(wallet.address)
//   await pool.join('100000000000000000', txnArgs)
//   const balance1 = await tusd.balanceOf(wallet.address)
//   await pool.borrow('50000000000000000', txnArgs)
//   console.log((await tusd.balanceOf(pool.address)).toString())
//   const balance2 = await tusd.balanceOf(wallet.address)
//   await tusd.approve(pool.address, '50000000000000000')
//   await pool.repay('50000000000000000', txnArgs)
//   const cToken = TrueUsdFactory.connect(await curvePool.token(), wallet)
//   console.log((await cToken.balanceOf(pool.address)).toString())
//   console.log((await pool.balanceOf(wallet.address)).toString())
//   const balance3 = await tusd.balanceOf(wallet.address)
//   await pool.exit(await pool.balanceOf(wallet.address), txnArgs)
//   const balance4 = await tusd.balanceOf(wallet.address)
//   console.log(balance0.toString())
//   console.log(balance1.toString())
//   console.log(balance2.toString())
//   console.log(balance3.toString())
//   console.log(balance4.toString())
// }

// async function transferAll () {
//   const wallet = new ethers.Wallet('<PRIVATE_KEY>', provider)
//   const tusd = TrueUsdFactory.connect('0x0000000000085d4780B73119b644AE5ecd22b376', wallet)
//   const [wallet2] = provider.getWallets()
//   await tusd.transfer(wallet2.address, await tusd.balanceOf(wallet.address))
// }

// transferAll().then(runTest).catch(console.error)
