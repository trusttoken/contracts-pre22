import { Contract, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { expect, use } from 'chai'
import { unknown as deployments } from '../../deployments-watr_local.json'
import {IERC20__factory, TokenControllerV3__factory, TrueUSD__factory} from 'contracts'
import { parseEther } from '@ethersproject/units'
import { solidity } from 'ethereum-waffle'
import {generatePrecompileAddress} from "../../utils/generatePrecompileAddress";
import {parseTrueUSD} from "utils";

use(solidity)

describe('verify deployment', () => {
  const localWatrUrl = 'http://127.0.0.1:8822'
  const chainId = 688
  const provider = new JsonRpcProvider(localWatrUrl, chainId)
  const ownableInterface = [
    'function owner() view returns (address)',
    'function proxyOwner() view returns (address)',
  ]
  const ownableContract = (address: string) => new Contract(
    address,
    ownableInterface,
    provider,
  )

  it('controller owns currency', async () => {
    const contract = ownableContract(deployments.trueUSD_proxy.address)

    const owner = await contract.owner()
    const proxyOwner = await contract.proxyOwner()

    expect(owner).to.eq(deployments.tokenControllerV3_proxy.address)
    expect(proxyOwner).to.eq(deployments.tokenControllerV3_proxy.address)
  })

  it('controller has currency set as token', async () => {
    const contract = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, provider)

    const token = await contract.token()

    expect(token).to.eq(deployments.trueUSD_proxy.address)
  })

  it('controller has registry set correctly', async () => {
    const contract = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, provider)

    const token = await contract.registry()

    expect(token).to.eq(deployments.registry_proxy.address)
  })

  it('can mint', async () => {
    const deployer = new ethers.Wallet(process.env['PRIVATE_KEY_DEPLOYER'], provider)
    const tokenController = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer)
    const token = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
    const accountAddress = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'

    const tx = () => waitFor(tokenController.instantMint(accountAddress, parseEther('1')))

    await expect(tx).to.changeTokenBalance(token, toAccount(accountAddress), parseEther('1'))
  })

  it('can transfer', async () => {
    const deployer = new ethers.Wallet(process.env['PRIVATE_KEY_DEPLOYER'], provider)
    const tokenController = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer)
    const token = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
    const otherAddress = '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9'

    await waitFor(tokenController.instantMint(deployer.address, parseEther('1')))

    const tx = () => waitFor(token.transfer(otherAddress, parseEther('0.5')))

    await expect(tx).to.changeTokenBalances(token, [deployer, toAccount(otherAddress)], [parseEther('-0.5'), parseEther('0.5')])
  }).timeout(100000)

  it('token has the right precompile address', async () => {
    const deployer = new ethers.Wallet(process.env['PRIVATE_KEY_DEPLOYER'], provider)
    const token = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
    const precompile = await token.nativeToken()

    expect(precompile).to.eq(generatePrecompileAddress(2018))
  })

  it('cannot transfer directly with precompile', async () => {
    const deployer = new ethers.Wallet(process.env['PRIVATE_KEY_DEPLOYER'], provider)
    const wallet = ethers.Wallet.createRandom().connect(provider)
    const tokenController = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer)

    await waitFor(tokenController.instantMint(wallet.address, parseTrueUSD('10')))

    const xc20 = IERC20__factory.connect(generatePrecompileAddress(2018), wallet)

    await expect(xc20.transfer(deployer.address, parseTrueUSD('5'))).to.be.reverted
  })
})

async function waitFor<T>(tx: Promise<{ wait: () => Promise<T> }>) {
  return (await tx).wait()
}

function toAccount(address: string) {
  return { getAddress: () => address }
}
