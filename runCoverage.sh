uncommented="await provider.send('hardhat_reset"
commented="\/\/ await provider.send('hardhat_reset"

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        v="${1/--/}"
        declare $v="$2"
   fi
  shift
done
if [ -z "$testfiles" ]; then
  testfiles="test/{governance,proxy,registry,true-currencies,true-gold,truefi,truefi2,trusttoken}/**/*.test.ts"
fi
if [ -z "$solcoverjs" ]; then
  solcoverjs="./.solcover.js"
fi

find ./test -type f -exec sed -i '' -e "s/$uncommented/$commented/g" {} +;
echo "Run coverage for tests matching: '$testfiles'"
node --max-old-space-size=6096 ./node_modules/.bin/hardhat coverage --testfiles $testfiles --solcoverjs $solcoverjs;
find ./test -type f -exec sed -i '' -e "s/$commented/$uncommented/g" {} +;
