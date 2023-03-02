import { Contract } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import { unknown as deployments } from '../deployments-watr_local.json'

describe('verify deployment', () => {
  const provider = new JsonRpcProvider('http://127.0.0.1:8822', 688)
  const ownableInterface = [
    'function owner() view returns (address)',
    'function proxyOwner() view returns (address)',
  ]
  const controllerInterface = [
    ...ownableInterface,
    'function token() view returns (address)',
    'function registry() view returns (address)',
  ]

  const ownableContract = (address: string) => new Contract(
    address,
    controllerInterface,
    provider,
  )

  const controllerContract = (address: string) => new Contract(
    address,
    controllerInterface,
    provider,
  )

  it('controller owns currency', async () => {
    const contract = ownableContract(deployments.trueUSD_proxy.address)

    const owner = await contract.owner()

    expect(owner).to.eq(deployments.tokenControllerV3_proxy.address)
  })

  it('controller has currency set as token', async () => {
    const contract = controllerContract(deployments.tokenControllerV3_proxy.address)

    const token = await contract.token()

    expect(token).to.eq(deployments.trueUSD_proxy.address)
  })

  it('controller has registry set correctly', async () => {
    const contract = controllerContract(deployments.tokenControllerV3_proxy.address)

    const token = await contract.registry()

    expect(token).to.eq(deployments.registry_proxy.address)
  })
})
