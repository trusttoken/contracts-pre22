## `MockTrueCurrencyWithLegacyAutosweep`



Contract that prevents addresses that were previously using autosweep addresses from
making transfers on them.
In older versions TrueCurrencies had a feature called Autosweep.
Given a single deposit address, it was possible to generate 16^5-1 autosweep addresses.
E.g. having deposit address 0xc257274276a4e539741ca11b590b9447b26a8051, you could generate
- 0xc257274276a4e539741ca11b590b9447b2600000
- 0xc257274276a4e539741ca11b590b9447b2600001
- ...
- 0xc257274276a4e539741ca11b590b9447b26fffff
Every transfer to an autosweep address resulted as a transfer to deposit address.
This feature got deprecated, but there were 4 addresses that still actively using the feature.
This contract will reject a transfer to these 4*(16^5-1) addresses to prevent accidental token freeze.


### `_transfer(address sender, address recipient, uint256 amount)` (internal)





### `requireNotAutosweepAddress(address recipient, address depositAddress)` (internal)






