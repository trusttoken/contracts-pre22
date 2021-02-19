## `RatingAgencyV2Distributor`

Distribute TRU to a smart contract


Allows for arbitrary claiming of TRU by a farm contract
Contracts are registered to receive distributions. Once registered,
a farm contract can claim TRU from the distributor.
- Owner can withdraw funds in case distribution need to be re-allocated

### `onlyBeneficiary()`



Only beneficiary can receive TRU


### `initialize(address _beneficiary, contract IERC20 _trustToken)` (public)



Initialize distributor


### `setBeneficiaryStatus(address _beneficiary, bool _status)` (public)



Owner can set beneficiary status


### `distribute(uint256 _amount)` (public)



Distribute arbitrary number of tokens


### `empty()` (public)



Withdraw funds (for instance if owner decides to create a new distribution) and end distribution cycle


### `Distributed(uint256 amount)`





### `BeneficiaryStatusChanged(address beneficiary, bool status)`





