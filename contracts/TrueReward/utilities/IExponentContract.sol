pragma solidity ^0.5.13;

/**
 * Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
 * Return the result along with the precision used.
 */
contract IExponentContract {
    function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) public view returns (uint256, uint8);
}