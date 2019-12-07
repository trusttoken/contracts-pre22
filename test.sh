#!/bin/bash

cd $(dirname $0)

for testfile in tests/*.test.js ; do
    testfile=$(basename $testfile)
    ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
    GPID=$!
    echo $testfile
    mv tests/$testfile test
    sleep 1
    truffle test $@
    mv test/$testfile tests
    kill -15 $GPID
done

exit
