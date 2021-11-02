methods {
  poolBasicRate(address, uint256) returns uint256 envfree

  liquidRatio(uint256) returns uint256 => DISPATCHER(true)
  getWeeklyAPY() returns uint256 => DISPATCHER(true)
  balanceOf() returns uint256 => DISPATCHER(true)
}

rule poolBasicRateIsMonotoneWrtAmount {
  uint256 amount1;
  uint256 amount2;
  address pool;

  require amount1 <= amount2;

  uint256 rate1 = poolBasicRate(pool, amount1);
  uint256 rate2 = poolBasicRate(pool, amount2);

  assert rate1 <= rate2, "poolBasicRate() is not monotone";
}
