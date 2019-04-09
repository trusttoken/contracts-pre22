#!/bin/bash
ganache-cli -l 0x7a1200 >/dev/null &
GPID=$!
sleep 1
truffle test $@
kill -15 $GPID
exit
