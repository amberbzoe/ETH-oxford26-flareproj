// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IFtsoRegistry.sol";
import "./interfaces/IFlareDataConnector.sol";

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
    // Flare Data Connector (FDC)
    IFlareDataConnector public fdc;
    
    string public constant ASSET_SYMBOL = "WNAT"; // For testing on Coston2, usually maps to FLR

    event Deposit(address indexed user, uint256 amount);
    event ProtectionExecuted(address indexed user, uint256 amountSwapped, uint256 price, string reason);
    event FtsoRegistryUpdated(address indexed newRegistry);

    constructor(address _ftsoRegistry, address _fdc) Ownable(msg.sender) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
        fdc = IFlareDataConnector(_fdc);
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

    /**
     * @notice Checks conditions and executes protection.
     * @param _user The user to protect.
     * @param _fdcProof Optional: Proof from FDC for an event trigger (empty if checking price only).
     */
    function executeProtection(address _user, bytes calldata _fdcProof) external {
        ProtectionRule storage rule = protectionRules[_user];
        require(rule.active, "No active protection rule");
        require(deposits[_user] > 0, "No deposit to protect");
        
        // 1. Check FTSO Price (Price Trigger)
        (uint256 currentPrice, , ) = ftsoRegistry.getCurrentPriceWithDecimals(ASSET_SYMBOL);
        bool priceTriggered = currentPrice < rule.priceThreshold;
        
        // 2. Check FDC Event (Event Trigger)
        bool eventTriggered = false;
        if (_fdcProof.length > 0) {
            // Verify that the proof is valid according to the FDC
            // Ideally, this proof confirms a specific event like "SEC Action" or "Stablecoin Depeg"
            eventTriggered = fdc.verify(_fdcProof);
        }

        require(priceTriggered || eventTriggered, "Protection conditions not met");

        // 3. Swap funds via DEX (Mock for now)
        uint256 amountToSave = deposits[_user];
        deposits[_user] = 0;
        rule.active = false; 
        
        payable(_user).transfer(amountToSave);

        emit ProtectionExecuted(_user, amountToSave, currentPrice, eventTriggered ? "Event Trigger" : "Price Trigger");
    }
}
