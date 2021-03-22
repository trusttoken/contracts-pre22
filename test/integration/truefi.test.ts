import { TEST_STATE_BLOCK_NUMBER, upgradeSuite } from './suite'
import {
  ArbitraryDistributorFactory,
  LinearTrueDistributorFactory,
  LiquidatorFactory, LoanFactoryFactory, RatingAgencyV2DistributorFactory, TrueFarmFactory, TrueFiPoolFactory, TrueLenderFactory, TrueRatingAgencyFactory, TrueRatingAgencyV2Factory,
} from 'contracts'
import { expect, use } from 'chai'
import { Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('TrueFi', () => {
  const emptyAddress = Wallet.createRandom().address

  it('Liquidator', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, LiquidatorFactory, '0x76dd4921C99AC6b61b3a98f9fa6f181cA6D70c77', [
      'pool',
      'stkTru',
      'tru',
      'oracle',
      'factory',
    ])
  })

  it('LoanFactory', async () => {
    // this needs to be updated once in a while, this loan will exist till 06/06/21
    const existingLoan = '0x583F674b8E2c36807E7371b2D27849F0E98549cc'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, LoanFactoryFactory, '0x4ACE6dE67E9a9EDFf5c2d0a584390Fb5394119e7', [
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

    const contract = await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueFarmFactory, '0x8FD832757F58F71BAC53196270A4a55c8E1a29D9', [
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
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueFiPoolFactory, '0xa1e72267084192db7387c8cc1328fade470e4149', [
      '_curvePool',
      '_curveGauge',
      '_currencyToken',
      '_lender',
      '_minter',
      '_uniRouter',
      'joiningFee',
      'claimableFees',
      '_stakeToken',
      '_oracle',
      'fundsManager',
      'isJoiningPaused',
      // '_1inchExchange', not yet deployed
    ])
  })

  it('TrueLender', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueLenderFactory, '0x16d02Dc67EB237C387023339356b25d1D54b0922', [
      'pool',
      'currencyToken',
      'ratingAgency',
      'minApy',
      'maxApy',
      'participationFactor',
      'riskAversion',
      'minSize',
      'maxSize',
      'minTerm',
      'maxTerm',
      'votingPeriod',
      'maxLoans',
      'stakingPool',
      'loans',
    ])
  })

  it('TrueRatingAgency', async () => {
    const allowedSubmitter = '0x83c1b27276108c0f68c52c2319beed4646061a1f'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueRatingAgencyFactory, '0x43A4F930F2cC35948d3a6dcd47CD0E50761f9B88', [
      (contract) => contract.allowedSubmitters(allowedSubmitter),
      'trustToken',
      'distributor',
      'factory',
      'lossFactor',
      'burnFactor',
      'rewardMultiplier',
      'submissionPauseStatus',
    ])
  })

  it('TrueRatingAgencyV2', async () => {
    const allowedSubmitter = '0xd5dee8195ae62bc011a89f1959a7a375cc0daf38'

    // this needs to be updated once in a while, this loan will exist till 06/06/21
    const existingLoan = '0x583F674b8E2c36807E7371b2D27849F0E98549cc'

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, TrueRatingAgencyV2Factory, '0x05461334340568075bE35438b221A3a0D261Fb6b', [
      (contract) => contract.allowedSubmitters(allowedSubmitter),
      (contract) => contract.loans(existingLoan),
      'TRU',
      'stkTRU',
      'distributor',
      'factory',
      'ratersRewardFactor',
      'rewardMultiplier',
      'submissionPauseStatus',
    ])
  })

  it('ArbitraryDistributor', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, ArbitraryDistributorFactory, '0x440ed3e4b10b12fA2bab441a3c44B9550BA9Df32', [
      'trustToken',
      'beneficiary',
      'amount',
      'remaining',
    ])
  })

  it('LinearDistributor', async () => {
    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, LinearTrueDistributorFactory, '0xfB8d918428373f766B352564b70d1DcC1e3b6383', [
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

    await upgradeSuite(TEST_STATE_BLOCK_NUMBER, RatingAgencyV2DistributorFactory, '0x6151570934470214592AA051c28805cF4744BCA7', [
      (contract) => contract.beneficiaries(beneficiaryAddress),
      'trustToken',
      'beneficiary',
      'amount',
      'remaining',
    ])
  })
})
