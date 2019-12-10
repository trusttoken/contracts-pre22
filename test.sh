#!/bin/bash

cd $(dirname $0)

ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
for testfile in tests/*.test.js ; do
    testfile=$(basename $testfile)
    echo $testfile
    mv tests/$testfile test
    truffle test $@
    mv test/$testfile tests
done
kill -15 $GPID

exit
