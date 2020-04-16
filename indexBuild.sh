ODline=$(grep 'outputDirectory' .waffle.json)
regex=': \"(.+)\"'
[[ $ODline =~ $regex ]]
outputDir=${BASH_REMATCH[1]}

touch $outputDir/index.js
> $outputDir/index.js

for file in $outputDir/*
do
    ODline=$(grep 'outputDirectory' .waffle.json)
    regex='\/([a-zA-Z0-9_]+)\.'
    [[ $file =~ $regex ]]
    name=${BASH_REMATCH[1]}
    if [ name != "index" ]
	then echo "const $name = require(\"$name.json\")" >> $outputDir/index.js
    fi
done

echo "module.exports = {" >> $outputDir/index.js

for file in $outputDir/*
do
    ODline=$(grep 'outputDirectory' .waffle.json)
    regex='\/([a-zA-Z0-9_]+)\.'
    [[ $file =~ $regex ]]
    name=${BASH_REMATCH[1]}
    if [ name != "index" ]
	then echo "$name," >> $outputDir/index.js
    fi
done

echo "}" >> $outputDir/index.js