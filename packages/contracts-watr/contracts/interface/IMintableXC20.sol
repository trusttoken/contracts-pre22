
interface IMintableXC20 {
    function mint(address to, uint256 value) external returns (bool);
    function burn(address from, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}
