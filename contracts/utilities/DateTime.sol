pragma solidity ^0.4.23;

/*
Abstract contract for interfacing with the DateTime contract.
*/
contract DateTimeAPI {
    function isLeapYear(uint16 year) public view returns (bool);
    function getYear(uint timestamp) public view returns (uint16);
    function getMonth(uint timestamp) public view returns (uint8);
    function getDay(uint timestamp) public view returns (uint8);
    function getHour(uint timestamp) public view returns (uint8);
    function getMinute(uint timestamp) public view returns (uint8);
    function getSecond(uint timestamp) public view returns (uint8);
    function getWeekday(uint timestamp) public view returns (uint8);
    function toTimestamp(uint16 year, uint8 month, uint8 day) public view returns (uint timestamp);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour) public view returns (uint timestamp);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute) public view returns (uint timestamp);
    function toTimestamp(uint16 year, uint8 month, uint8 day, uint8 hour, uint8 minute, uint8 second) public view returns (uint timestamp);
}
