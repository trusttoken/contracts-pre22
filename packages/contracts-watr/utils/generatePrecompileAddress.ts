import {utils} from "ethers";

export function generatePrecompileAddress(assetId: number) {
    const idHex = assetId.toString(16)
    return utils.getAddress('0xffffffff' + Array.from({ length: 32 - idHex.length }, () => '0').join('') + idHex)
}
