uncommented="await provider.send('hardhat_reset"
commented="\/\/ await provider.send('hardhat_reset"

find ./test -type f -exec sed -i '' -e "s/$uncommented/$commented/g" {} +;
node --max-old-space-size=6096 ./node_modules/.bin/hardhat coverage "$@" --testfiles "test/{governance,proxy,registry,true-currencies,true-gold,truefi,truefi2,trusttoken}/**/*.test.ts";
find ./test -type f -exec sed -i '' -e "s/$commented/$uncommented/g" {} +;
