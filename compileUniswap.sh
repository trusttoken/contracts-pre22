#!/bin/bash

ODline=$(grep 'outputDirectory' .waffle.json)
regex=': \"(.+)\"'
[[ $ODline =~ $regex ]]
outputDir=${BASH_REMATCH[1]}

UFabi=$(vyper ./contracts/lib/uniswap/contracts/uniswap_factory.vy -f abi)
UFbytecode=$(vyper ./contracts/lib/uniswap/contracts/uniswap_factory.vy -f bytecode)
rm -rf $outputDir/uniswap_factory.json
echo "{
    \"bytecode\": \"$UFbytecode\",
    \"abi\": $UFabi
}" >> $outputDir/uniswap_factory.json

UEabi=$(vyper ./contracts/lib/uniswap/contracts/uniswap_exchange.vy -f abi)
UEbytecode=$(vyper ./contracts/lib/uniswap/contracts/uniswap_exchange.vy -f bytecode)
rm -rf $outputDir/uniswap_exchange.json
echo "{
    \"bytecode\": \"$UEbytecode\",
    \"abi\": $UEabi
}" >> $outputDir/uniswap_exchange.json