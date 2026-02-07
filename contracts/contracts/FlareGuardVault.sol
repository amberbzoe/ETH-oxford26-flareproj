// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IFtsoRegistry.sol";

contract FlareGuardVault is Ownable {
    
    struct ProtectionRule {
        address user;
        uint256 priceThreshold; // e.g., if price < $0.45
        bool active;
    }

    mapping(address => ProtectionRule) public protectionRules;
    mapping(address => uint256) public deposits;
    
    // Flare FTSO Registry
    IFtsoRegistry public ftsoRegistry;
    string public constant ASSET_SYMBOL = "WNAT"; // For testing on Coston2, usually maps to FLR

    event Deposit(address indexed user, uint256 amount);
    event ProtectionExecuted(address indexed user, uint256 amountSwapped, uint256 price);
    event FtsoRegistryUpdated(address indexed newRegistry);

    constructor(address _ftsoRegistry) Ownable(msg.sender) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
    }

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
        require(deposits[_user] > 0, "No deposit to protect");
        
        // 1. Check FTSO Price (Price Trigger)
        (uint256 currentPrice, , uint256 decimals) = ftsoRegistry.getCurrentPriceWithDecimals(ASSET_SYMBOL);
        
        // Adjust rule threshold to match FTSO decimals (usually 5)
        // For simplicity, we assume the user sets the threshold in the same 5-decimal format 
        // OR we normalize here. Let's assume input is standard USD (e.g. 0.45 * 10^5 = 45000)
        
        bool priceTriggered = currentPrice < rule.priceThreshold;
        
        // TODO: Add FDC Check (Event Trigger) here

        require(priceTriggered, "Protection conditions not met");

        // 2. Swap funds via DEX (Mock for now)
        // In reality, this would call Uniswap/Pangolin router to swap WNAT -> USDC
        
        uint256 amountToSave = deposits[_user];
        deposits[_user] = 0;
        rule.active = false; 
        
        // Transfer funds back to user (or swapped stablecoins)
        payable(_user).transfer(amountToSave);

        emit ProtectionExecuted(_user, amountToSave, currentPrice);
    }
}
