
interface IMintableXC20 {
    function mint(address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);

}
