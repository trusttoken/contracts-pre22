#!/bin/bash

set -e

ODline=$(grep 'outputDirectory' .waffle.json)
regex=': \"(.+)\"'
[[ $ODline =~ $regex ]]
outputDir=${BASH_REMATCH[1]}

touch $outputDir/index.js
> $outputDir/index.js

for file in $outputDir/*.json
do
    ODline=$(grep 'outputDirectory' .waffle.json)
    regex='\/([a-zA-Z0-9_]+)\.'
    [[ $file =~ $regex ]]
    name=${BASH_REMATCH[1]}
	  echo "const $name = require(\"./$name.json\")" >> $outputDir/index.js
done

echo "module.exports = {" >> $outputDir/index.js

for file in $outputDir/*.json
do
    ODline=$(grep 'outputDirectory' .waffle.json)
    regex='\/([a-zA-Z0-9_]+)\.'
    [[ $file =~ $regex ]]
    name=${BASH_REMATCH[1]}
	  echo "  $name," >> $outputDir/index.js
done

echo "}" >> $outputDir/index.js

touch $outputDir/types/index.d.ts
> $outputDir/types/index.d.ts

for file in $outputDir/types/*
do
    regex='\/([a-zA-Z0-9_]+)\.'
    [[ $file =~ $regex ]]
    name=${BASH_REMATCH[1]}
    if [ $name != "index" ]
	    then echo "export { $name } from '$name'" >> $outputDir/types/index.d.ts
    fi
done
