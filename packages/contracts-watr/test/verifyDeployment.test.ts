import {BigNumber, Contract, ethers} from 'ethers'
import {JsonRpcProvider} from '@ethersproject/providers'
import {expect} from 'chai'
import {unknown as deployments} from '../deployments-watr_local.json'
import {parseEth} from "../../../test/utils";
import {waitForTx} from "../../../scripts/utils/waitForTx";
import {TokenController} from "../../../build";
import {TokenControllerV3} from "build/artifacts";
import {TokenControllerV3__factory, TrueUSD__factory} from "contracts";
import {parseEther} from "@ethersproject/units";

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
        const proxyOwner = await contract.proxyOwner()

        expect(owner).to.eq(deployments.tokenControllerV3_proxy.address)
        expect(proxyOwner).to.eq(deployments.tokenControllerV3_proxy.address)
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

    it('can mint', async () => {
        let deployer = new ethers.Wallet('', provider);


        const controllerV3 = TokenControllerV3__factoryllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer);

        const tx = await controllerV3.instantMint(deployer.address, parseEther('1'))
        await tx.wait()

        const trueUSD = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
        const balance  = await trueUSD.balanceOf(deployer.address)
        expect(balance.toString()).to.eq('1')
    });
})
