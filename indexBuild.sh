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
	  echo "  ${name}Json," >> $outputDir/index.js
done

echo "}" >> $outputDir/index.js
