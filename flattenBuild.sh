#!/bin/bash
set -e

ODline=$(grep 'artifacts' hardhat.config.ts)
regex=': \"(.+)\"'
echo $ODline
[[ $ODline =~ $regex ]]
outputDir=${BASH_REMATCH[1]}
echo $outputDir

touch $outputDir/index.ts
> $outputDir/index.ts

for file in $(find $outputDir -name '[a-zA-Z_]*.json' -not -name '*.dbg.json')
do
	mv $file $outputDir
done

echo "Build files moved succesfully!"