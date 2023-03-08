import { Contract, ethers } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import { unknown as deployments } from '../../deployments-watr_local.json'
import { TokenControllerV3__factory, TrueUSD__factory } from 'contracts'
import { parseEther } from '@ethersproject/units'

describe('verify deployment', () => {
  const provider = new JsonRpcProvider('http://127.0.0.1:8822', 688)
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

    const balanceBefore = await token.balanceOf(accountAddress)

    await waitFor(tokenController.instantMint(accountAddress, parseEther('1')))

    const balanceAfter = await token.balanceOf(accountAddress)

    expect(balanceAfter.sub(balanceBefore).toString()).to.eq(parseEther('1').toString())
  })

  it('can transfer', async () => {
    const deployer = new ethers.Wallet(process.env['PRIVATE_KEY_DEPLOYER'], provider)
    const tokenController = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer)
    const token = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
    const otherAddress = '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9'

    const balancesBefore = [
      await token.balanceOf(deployer.address),
      await token.balanceOf(otherAddress),
    ]

    await waitFor(tokenController.instantMint(deployer.address, parseEther('1')))

    await waitFor(token.transfer(otherAddress, parseEther('0.5')))

    const balancesAfter = [
      await token.balanceOf(deployer.address),
      await token.balanceOf(otherAddress),
    ]

    expect(balancesAfter[0].sub(balancesBefore[0]).toString()).to.eq(parseEther('0.5').toString())
    expect(balancesAfter[1].sub(balancesBefore[1]).toString()).to.eq(parseEther('0.5').toString())
  }).timeout(100000)
})

async function waitFor<T>(tx: Promise<{ wait: () => Promise<T> }>) {
  return (await tx).wait()
}
