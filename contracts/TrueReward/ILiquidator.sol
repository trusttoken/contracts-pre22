interface ILiquidator {
    function reclaim(address _destination, int256 _debt) external;
}
