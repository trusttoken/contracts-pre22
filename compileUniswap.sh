#!/bin/bash

UFabi=$(vyper ./contracts/lib/uniswap/contracts/uniswap_factory.vy -f abi)
UFbytecode=$(vyper ./contracts/lib/uniswap/contracts/uniswap_factory.vy -f bytecode)
rm -rf build/uniswap_factory.json
echo "{
    \"bytecode\": \"$UFbytecode\",
    \"abi\": $UFabi
}" >> build/uniswap_factory.json

UEabi=$(vyper ./contracts/lib/uniswap/contracts/uniswap_exchange.vy -f abi)
UEbytecode=$(vyper ./contracts/lib/uniswap/contracts/uniswap_exchange.vy -f bytecode)
rm -rf build/uniswap_exchange.json
echo "{
    \"bytecode\": \"$UEbytecode\",
    \"abi\": $UEabi
}" >> build/uniswap_exchange.json