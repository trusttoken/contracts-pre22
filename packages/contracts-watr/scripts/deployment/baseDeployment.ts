import {contract, createProxy, ExecuteOptions} from "ethereum-mars";
import {OwnedUpgradeabilityProxy, TokenControllerV3} from "../../build/artifacts";

export function baseDeployment(deployer: string, options: ExecuteOptions) {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  const tokenControllerImplementation = contract(TokenControllerV3)
  const tokenControllerProxy = proxy(tokenControllerImplementation)

  return {
    tokenControllerImplementation,
    tokenControllerProxy,
  }
}
