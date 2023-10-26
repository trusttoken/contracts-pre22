// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "../base/BaseVerifyUpgradeableV1.sol";
import "../library/DefineRole.sol";

contract BFTokenUpgradeable is ERC20BurnableUpgradeable, BaseVerifyUpgradeableV1 {
  //////////////////// constant

  //////////////////// storage
 
  address public  IssueToAddress;
  bool  public paused;

  mapping (address => bool) public blacklisted;

  //////////////////// event
  event Pause(address indexed operator);
  event Unpause(address indexed operator);
  event Issue(address indexed operator, address indexed to, uint256 amount, string data);
  event Redeem(address indexed operator, address indexed from, uint256 amount);
  event SetIssueToAddress(address indexed operator, address indexed addr);
  event Blacklist(address indexed operator, address indexed addr);
  event Unblacklist(address indexed operator, address indexed addr);

  //////////////////// init
  
  function initialize(string memory name_,
                      string memory symbol_,
                      address configAddr_)
    public
    virtual
    initializer {
    __BFTokenUpgradeable_init(name_, symbol_, configAddr_);
  }
    
  function __BFTokenUpgradeable_init(string memory name_,
                                     string memory symbol_,
                                     address configAddr_)
    internal onlyInitializing{

    __ERC20_init_unchained(name_, symbol_);
    __BaseVerifyUpgradeableV1_init(configAddr_);
  }
  
  //////////////////// modifier
  modifier CheckPause(){
    require(!paused, "is pause");
    _;
  }

  //////////////////// modifier
  modifier CheckBlacklist(address addr){
    require(!blacklisted[addr], "in blacklist");
    _;
  }

  /**
   * @dev setIssueToAddress
   *
   *
   * Requirements:
   *
   * - the caller must have the `DEFAULT_ADMIN_ROLE`.
   */

  function setIssueToAddress(address newAddress) public IsAdmin{
    IssueToAddress = newAddress;
    emit SetIssueToAddress(_msgSender(), newAddress); 
  }

  /**
   * @dev Redeem user token
   *
   *
   * Requirements:
   *
   * - the caller must have the `ISSUER_ROLE`.
   */ 
  function issue(uint256 amount, string memory data)
    public
    onlyRole(DefineRole.TOKEN_ISSUER_ROLE)
    CheckPause
    CheckBlacklist(IssueToAddress){
    require(IssueToAddress != address(0x0), "target is 0");
        
    _mint(IssueToAddress, amount);
    emit Issue(_msgSender(), IssueToAddress, amount, data);
  }

  /**
   * @dev Redeem user token
   *
   *
   * Requirements:
   *
   * - the caller must have the `REDEEMER_ROLE`.
   */

  function burn(uint256 amount) public override onlyRole(DefineRole.TOKEN_REDEEMER_ROLE){
    address sender = _msgSender();
    _burn(sender, amount);
    emit Redeem(sender, sender, amount);
  }

  function burnFrom(address account, uint256 amount)
    public
    override
    onlyRole(DefineRole.TOKEN_MASTER_REDEEMER_ROLE){
    _burn(account, amount);
    emit Redeem(_msgSender(), account, amount);
  }

  /**
   * @dev Blacklist user
   *
   *
   * Requirements:
   *
   * - the caller must have the `BLACKLISTER_ROLE`.
   */ 
  function blacklist(address who)
    public
    onlyRole(DefineRole.TOKEN_BLACKLISTER_ROLE){
      
    if(!blacklisted[who]){
      blacklisted[who] = true;
      emit Blacklist(_msgSender(), who);
    }
  }
  
  /**
   * @dev unBlacklist user
   *
   *
   * Requirements:
   *
   * - the caller must have the `BLACKLISTER_ROLE`.
   */  
  function unblacklist(address who)
    public
    onlyRole(DefineRole.TOKEN_BLACKLISTER_ROLE){
      
    if(blacklisted[who]){
      blacklisted[who]=false;
      emit Unblacklist(_msgSender(), who);
    }
  }  

  /**
   * @dev Pauses all token transfers.
   *
   * See {ERC20Pausable} and {Pausable-_pause}.
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function pause()
    public
    onlyRole(DefineRole.TOKEN_PAUSER_ROLE){
      
    if(!paused){
      paused = true;
      emit Pause(_msgSender());
    }
  }

  /**
   * @dev Unpauses all token transfers.
   *
   *
   * Requirements:
   *
   * - the caller must have the `PAUSER_ROLE`.
   */
  function unpause()
    public
    onlyRole(DefineRole.TOKEN_PAUSER_ROLE){
      
    if(paused){
      paused = false;
      emit Unpause(_msgSender());
    }
  }

  /**
   * @dev Token Transfer
   *
   * SEE ERC20Standard
   *
   * Requirements:
   *
   * - the caller must have enough balance
   */
  function transfer(address recipient, uint256 amount)
    public
    override
    CheckPause
    CheckBlacklist(recipient)
    CheckBlacklist(_msgSender())
    returns (bool) {
    
    _transfer(_msgSender(), recipient, amount);
    return true;
  }
    
  /**
   * @dev Token Transferfrom
   *
   * SEE ERC20Standard
   *
   * Requirements:
   *
   * - the caller must have enough balance
   */

  function transferFrom(address sender, address recipient, uint256 amount)
    public
    override
    CheckPause
    CheckBlacklist(sender)
    CheckBlacklist(recipient)
    returns (bool) {
    return super.transferFrom(sender, recipient, amount);
  }
    
  function decimals() public pure override returns (uint8) {
    return 18;
  }
}
