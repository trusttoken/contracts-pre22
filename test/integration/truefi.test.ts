import { TEST_STATE_BLOCK_NUMBER, upgradeSuite } from './suite'
import {
  ArbitraryDistributor__factory,
  LinearTrueDistributor__factory,
  LoanFactory__factory,
  RatingAgencyV2Distributor__factory,
  TrueFarm__factory,
  TrueFiPool__factory,
  TrueLender__factory,
  TrueRatingAgencyV2__factory,
} from 'contracts'
import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueFi', () => {
  const emptyAddress = Wallet.createRandom().address

  it('LoanFactory', async () => {
    // this needs to be updated once in a while, this loan will exist till 06/06/21
    const existingLoan = '0x583F674b8E2c36807E7371b2D27849F0E98549cc'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, LoanFactory__factory, '0x4ACE6dE67E9a9EDFf5c2d0a584390Fb5394119e7', [
      (contract) => contract.isLoanToken(emptyAddress),
      (contract) => contract.isLoanToken(existingLoan),
      'currencyToken',
      'lender',
      'liquidator',
    ])
  })

  it('TrueFarm', async () => {
    // same as before, may need to find a better method for getting such addresses
    const addressWithStakedTokens = '0x788550d00579f66c06ce209d14056c8f2c0a8188'

    const contract = await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueFarm__factory, '0x8FD832757F58F71BAC53196270A4a55c8E1a29D9', [
      (contract) => contract.staked(emptyAddress),
      (contract) => contract.staked(addressWithStakedTokens),
      (contract) => contract.previousCumulatedRewardPerToken(emptyAddress),
      (contract) => contract.previousCumulatedRewardPerToken(addressWithStakedTokens),
      (contract) => contract.claimableReward(emptyAddress),
      (contract) => contract.claimableReward(addressWithStakedTokens),
      'stakingToken',
      'trustToken',
      'trueDistributor',
      'name',
      'totalStaked',
      'cumulativeRewardPerToken',
      'totalClaimedRewards',
      'totalFarmRewards',
    ])
    expect(await contract.claimable(emptyAddress)).to.be.eq(0)
    expect(await contract.claimable(addressWithStakedTokens)).to.be.gt(0)
  })

  it('TrueFiPool', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueFiPool__factory, '0xa1e72267084192db7387c8cc1328fade470e4149', [
      '_curvePool',
      '_curveGauge',
      // '_currencyToken', renamed to token
      '_lender',
      '_minter',
      '_uniRouter',
      'joiningFee',
      'claimableFees',
      'fundsManager',
      // '_stakeToken',
      // 'isJoiningPaused', Renamed to pauseStatus
      // 'oracle',
      // '_crvOracle',
      // '_1inchExchange', not yet deployed
    ])
  })

  it('TrueLender', async () => {
    const contract = await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueLender__factory, '0x16d02Dc67EB237C387023339356b25d1D54b0922', [
      'pool',
      'currencyToken',
      'ratingAgency',
      'minApy',
      'maxApy',
      // 'participationFactor', Renamed to minVotes
      // 'riskAversion', Renamed to minRatio
      'minSize',
      'maxSize',
      'minTerm',
      'maxTerm',
      'votingPeriod',
      'maxLoans',
      'stakingPool',
      'loans',
    ])
    expect(await contract.minVotes()).to.eq(5000)
    expect(await contract.minRatio()).to.eq(15000)
  })

  it('TrueRatingAgencyV2', async () => {
    // this needs to be updated once in a while, this loan will exist till 06/06/21
    const existingLoan = '0x583F674b8E2c36807E7371b2D27849F0E98549cc'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueRatingAgencyV2__factory, '0x05461334340568075bE35438b221A3a0D261Fb6b', [
      (contract) => contract.loans(existingLoan),
      'TRU',
      'stkTRU',
      'distributor',
      'factory',
      'ratersRewardFactor',
      'rewardMultiplier',
    ])
  })

  it('ArbitraryDistributor', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, ArbitraryDistributor__factory, '0x440ed3e4b10b12fA2bab441a3c44B9550BA9Df32', [
      'trustToken',
      'beneficiary',
      'amount',
      'remaining',
    ])
  })

  it('LinearDistributor', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, LinearTrueDistributor__factory, '0xfB8d918428373f766B352564b70d1DcC1e3b6383', [
      'trustToken',
      'distributionStart',
      'duration',
      'totalAmount',
      'lastDistribution',
      'distributed',
      'farm',
    ])
  })

  it('RatingAgencyV2Distributor', async () => {
    const beneficiaryAddress = '0x05461334340568075bE35438b221A3a0D261Fb6b'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, RatingAgencyV2Distributor__factory, '0x6151570934470214592AA051c28805cF4744BCA7', [
      (contract) => contract.beneficiaries(beneficiaryAddress),
      'trustToken',
      'beneficiary',
      'amount',
      'remaining',
    ])
  })
})
