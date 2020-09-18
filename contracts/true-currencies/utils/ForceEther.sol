// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

// Source: @openzeppelin/contracts/mocks/ForceEther.sol
// @title Force Ether into a contract.
// @notice  even
// if the contract is not payable.
// @notice To use, construct the contract with the target as argument.
// @author Remco Bloemen <remco@neufund.org>
contract ForceEther {
    // solhint-disable-next-line no-empty-blocks
    constructor() public payable {}

    function destroyAndSend(address _recipient) public {
        selfdestruct(address(uint160(_recipient)));
    }
}
