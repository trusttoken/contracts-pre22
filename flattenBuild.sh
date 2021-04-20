#!/bin/bash
echo "0"
set -e
echo "1"

ODline=$(grep 'artifacts' ./hardhat.config.ts)
echo "2"
regex=": \'(.+)\'"
echo "3"
[[ $ODline =~ $regex ]]
echo "4"
outputDir=${BASH_REMATCH[1]}
echo "5"

touch $outputDir/index.ts
echo "6"
> $outputDir/index.ts

for file in $(find $outputDir -name '[a-zA-Z_]*.json' -not -name '*.dbg.json')
do
	mv $file $outputDir
done

echo "Build files moved succesfully!"