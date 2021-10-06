// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../../truefi/TrueRatingAgencyV2.sol";

contract TestTrueRatingAgencyV2 is TrueRatingAgencyV2 {
    function yes(address id, uint256 stake) external {
        loans[id].prediction[true] = loans[id].prediction[true].add(stake);
        loans[id].ratings[msg.sender][true] = loans[id].ratings[msg.sender][true].add(stake);
    }

    function submit(address id) external {
        loans[id] = Loan({creator: msg.sender, timestamp: block.timestamp, blockNumber: block.number, reward: 0});
    }
}
