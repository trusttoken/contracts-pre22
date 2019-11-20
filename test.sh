#!/bin/bash
ganache-cli -l 0x895440 -k istanbul >/dev/null &
GPID=$!
sleep 1
truffle test $@
kill -15 $GPID
exit
