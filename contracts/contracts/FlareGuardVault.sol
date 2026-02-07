// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FlareGuardVault is Ownable {
    
    struct ProtectionRule {
        address user;
        uint256 priceThreshold; // e.g., if price < $0.45
        bool active;
    }

    mapping(address => ProtectionRule) public protectionRules;
    mapping(address => uint256) public deposits;

    event Deposit(address indexed user, uint256 amount);
    event ProtectionExecuted(address indexed user, uint256 amountSwapped);

    constructor() Ownable(msg.sender) {}

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function setProtectionRule(uint256 _priceThreshold) external {
        protectionRules[msg.sender] = ProtectionRule({
            user: msg.sender,
            priceThreshold: _priceThreshold,
            active: true
        });
    }

    function executeProtection(address _user) external {
        ProtectionRule storage rule = protectionRules[_user];
        require(rule.active, "No active protection rule");
        
        // TODO: Verify FTSO price here
        // TODO: Swap funds via DEX
        
        rule.active = false; // Disable after execution
        emit ProtectionExecuted(_user, deposits[_user]);
    }
}
