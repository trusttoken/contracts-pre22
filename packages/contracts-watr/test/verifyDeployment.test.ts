import {BigNumber, Contract, ethers, utils} from 'ethers'
import {JsonRpcProvider} from '@ethersproject/providers'
import {expect} from 'chai'
import {unknown as deployments} from '../deployments-watr_local.json'
import {parseEth} from "../../../test/utils";
import {waitForTx} from "../../../scripts/utils/waitForTx";
import {TokenController} from "../../../build";
import {TokenControllerV3} from "build/artifacts";
import {TokenControllerV3__factory, TrueUSD__factory} from "contracts";
import {parseEther} from "@ethersproject/units";

describe.skip('verify deployment', () => {
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

    const nativeTokenContract = (address: string) => new Contract(
        address,
        [
            'function mint(address beneficiary, uint256 amount) external returns (bool)',
            'function balanceOf(address who) external view returns (uint256)',
        ],
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
        let deployer = new ethers.Wallet('private_key', provider);

        const token = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)

        console.log({
            nativeToken: await token.nativeToken(),
        })

        const controllerV3 = TokenControllerV3__factory.connect(deployments.tokenControllerV3_proxy.address, deployer);

        const tx = await controllerV3.instantMint(deployer.address, parseEther('1'), { gasLimit: 1000000 })
        await tx.wait()

        const trueUSD = TrueUSD__factory.connect(deployments.trueUSD_proxy.address, deployer)
        const balance  = await trueUSD.balanceOf(deployer.address)
        const tx2 = await trueUSD.transfer('address', parseEther('0.5'), { gasLimit: 1000000 })
        await tx2.wait()

        const barance = await trueUSD.balanceOf('address')

        expect(balance.toString()).to.eq(parseEther('1'))
        expect(barance.toString()).to.eq(parseEther('0.5'))
    });

    it('works like ERC20', async () => {
        let deployer = new ethers.Wallet('private_key', provider);
        const token = nativeTokenContract(generatePrecompileAddress(1983))

        const tx = await token.connect(deployer).mint('address', parseEther('1'), { gasLimit: 100000 })
        await tx.wait()

        const balance = (await token.balanceOf('address')).toString()

        console.log({ balance })
    })
})

function generatePrecompileAddress(assetId: number) {
    const idHex = (1983).toString(16)
    return utils.getAddress('0xffffffff' + Array.from({ length: 32-idHex.length }, () => '0').join('') + idHex)
}
