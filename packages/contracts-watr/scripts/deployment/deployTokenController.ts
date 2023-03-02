import {AddressLike, contract, createProxy} from 'ethereum-mars'
import {
    OwnedUpgradeabilityProxy,
    TokenControllerV3
} from '../../build/artifacts'
import {parseEth} from "../../../../test/utils";
import {parseEther} from "@ethersproject/units";

export function deployTokenController() {
    const ownedUpgradabilityProxy = createProxy(OwnedUpgradeabilityProxy)

    const implementation = contract(TokenControllerV3)
    const proxy = ownedUpgradabilityProxy(implementation, (controller) => {
        controller.initialize()
    })

    return {
        implementation,
        proxy,
    }
}

export function setupTokenController(controller: ReturnType<typeof deployTokenController>['proxy'], token: AddressLike, registry: AddressLike) {
    controller.setRegistry(registry)
    controller.setToken(token)
    controller.claimTrueCurrencyProxyOwnership()
    controller.claimTrueCurrencyOwnership()
}

export function setupMintThresholds(controller: ReturnType<typeof deployTokenController>['proxy']) {
    controller.setMintThresholds(parseEther('1000000'), parseEther('5000000'), parseEther('10000000'))
    controller.setMintLimits(parseEther('10000000'), parseEther('50000000'), parseEther('100000000'))
}
