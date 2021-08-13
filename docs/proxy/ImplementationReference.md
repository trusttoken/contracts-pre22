## `ImplementationReference`



This contract is made to serve a simple purpose only.
To hold the address of the implementation contract to be used by proxy.
The implementation address, is changeable anytime by the owner of this contract.


### `constructor(address _implementation)` (public)



Set initial ownership and implementation address


### `setImplementation(address newImplementation)` (external)



Function to change the implementation address, which can be called only by the owner



### `ImplementationChanged(address newImplementation)`



Event to show that implementation address has been changed


