#!/bin/bash

set -e

ODline=$(grep 'outputDirectory' .waffle.json)
regex=': \"(.+)\"'
[[ $ODline =~ $regex ]]
outputDir=${BASH_REMATCH[1]}
mkdir -p $outputDir


if [[ $CI == true ]];
then
 path="./home/circleci/project/contracts"
else
 path="./contracts"
fi

source ./setup-vyper.sh

UFabi=$(vyper $path/lib/uniswap/contracts/uniswap_factory.vy -f abi)
UFbytecode=$(vyper $path/lib/uniswap/contracts/uniswap_factory.vy -f bytecode)
touch $outputDir/uniswap_factory.json
rm -rf $outputDir/uniswap_factory.json
echo "{
    \"bytecode\": \"$UFbytecode\",
    \"abi\": $UFabi
}" >> $outputDir/uniswap_factory.json

UEabi=$(vyper $path/lib/uniswap/contracts/uniswap_exchange.vy -f abi)
UEbytecode=$(vyper $path/lib/uniswap/contracts/uniswap_exchange.vy -f bytecode)
touch $outputDir/uniswap_exchange.json
rm -rf $outputDir/uniswap_exchange.json
echo "{
    \"bytecode\": \"$UEbytecode\",
    \"abi\": $UEabi
}" >> $outputDir/uniswap_exchange.json
