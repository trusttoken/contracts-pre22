// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ManagedPortfolio, IERC20WithDecimals} from "./ManagedPortfolio.sol";
import {BulletLoans} from "./BulletLoans.sol";
import {PortfolioConfig} from "./PortfolioConfig.sol";
import {BP} from "./types/BP.sol";

contract PortfolioFactory {
    BulletLoans public bulletLoans;
    PortfolioConfig public portfolioConfig;
    ManagedPortfolio[] public supportedPortfolios;

    event PortfolioCreated(ManagedPortfolio newPortfolio, address manager);

    constructor(BulletLoans _bulletLoans, PortfolioConfig _portfolioConfig) public {
        bulletLoans = _bulletLoans;
        portfolioConfig = _portfolioConfig;
    }

    function createPortfolio(
        address _manager,
        IERC20WithDecimals _underlyingToken,
        uint256 _duration,
        uint256 _maxSize,
        BP _managerFee,
        string memory _depositMessage
    ) public {
        ManagedPortfolio newPortfolio = new ManagedPortfolio(
            _manager,
            _underlyingToken,
            bulletLoans,
            portfolioConfig,
            _duration,
            _maxSize,
            _managerFee,
            _depositMessage
        );
        supportedPortfolios.push(newPortfolio);
        emit PortfolioCreated(newPortfolio, msg.sender);
    }

    function getSupportedPortfolios() public view returns (ManagedPortfolio[] memory) {
        return supportedPortfolios;
    }
}
