// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApi.sol";
import {IJsonApiVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApiVerification.sol";

contract FlareGuardVault {

    /// @notice Trigger type determines how the FDC event value is compared to dangerValue
    enum TriggerType {
        EXCHANGE_STATUS,    // Trigger when apiValue == dangerValue (e.g., maintenance mode = 1)
        FEAR_GREED_INDEX,   // Trigger when apiValue < dangerValue (e.g., index below 25 = extreme fear)
        BTC_DOMINANCE       // Trigger when apiValue > dangerValue (e.g., BTC.D above 60% = altcoin risk)
    }

    struct ProtectionRule {
        address owner;
        uint256 depositAmount;
        bytes21 priceFeedId;            // FTSO feed ID (e.g. FLR/USD)
        uint256 priceTrigger;           // Price threshold — protect if price drops below this
        TriggerType[] triggerTypes;     // Array of FDC trigger types
        uint256[] dangerValues;         // Matching thresholds for each trigger type
        bool isActive;
    }

    ProtectionRule[] public rules;

    // Common FTSO feed IDs
    bytes21 public constant FLR_USD_FEED_ID = bytes21(0x01464c522f55534400000000000000000000000000);
    bytes21 public constant XRP_USD_FEED_ID = bytes21(0x015852502f55534400000000000000000000000000);
    bytes21 public constant BTC_USD_FEED_ID = bytes21(0x014254432f55534400000000000000000000000000);
    bytes21 public constant ETH_USD_FEED_ID = bytes21(0x014554482f55534400000000000000000000000000);

    event RuleCreated(uint256 indexed ruleId, address indexed owner, uint256 depositAmount, uint256 priceTrigger);
    event ProtectionTriggered(uint256 indexed ruleId, address indexed owner, bool eventTrigger, bool priceTrigger);
    event Withdrawn(uint256 indexed ruleId, address indexed owner, uint256 amount);

    receive() external payable {}

    /// @notice Create a protection rule with multiple trigger types
    /// @param _priceFeedId FTSO feed ID to monitor
    /// @param _priceTrigger Price threshold — if feed value drops below this, trigger protection
    /// @param _triggerTypes Array of FDC trigger types to monitor
    /// @param _dangerValues Array of threshold values (must match triggerTypes length)
    function createRule(
        bytes21 _priceFeedId,
        uint256 _priceTrigger,
        TriggerType[] memory _triggerTypes,
        uint256[] memory _dangerValues
    ) external payable {
        require(msg.value > 0, "Must deposit tokens");
        require(_triggerTypes.length == _dangerValues.length, "Arrays must match");

        uint256 ruleId = rules.length;
        
        // Create rule with arrays
        ProtectionRule storage newRule = rules.push();
        newRule.owner = msg.sender;
        newRule.depositAmount = msg.value;
        newRule.priceFeedId = _priceFeedId;
        newRule.priceTrigger = _priceTrigger;
        newRule.isActive = true;
        
        // Copy arrays
        for (uint256 i = 0; i < _triggerTypes.length; i++) {
            newRule.triggerTypes.push(_triggerTypes[i]);
            newRule.dangerValues.push(_dangerValues[i]);
        }

        emit RuleCreated(ruleId, msg.sender, msg.value, _priceTrigger);
    }

    /// @notice Execute protection using FDC proof and/or FTSO price check
    /// @dev Anyone can call this (keeper pattern). Pass empty proof if using price trigger only.
    /// @param _ruleId The rule to execute
    /// @param _proof FDC JsonApi proof — pass empty merkleProof + zeroed data for price-only trigger
    function executeProtection(uint256 _ruleId, IJsonApi.Proof calldata _proof) external {
        require(_ruleId < rules.length, "Rule does not exist");
        ProtectionRule storage rule = rules[_ruleId];
        require(rule.isActive, "Rule not active");
        require(rule.depositAmount > 0, "No deposit");

        // 1. Check FTSO Price (Price Trigger)
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (uint256 currentPrice, , ) = ftsoV2.getFeedById(rule.priceFeedId);
        bool priceTriggered = currentPrice > 0 && currentPrice < rule.priceTrigger;

        // 2. Check FDC Event (Event Trigger) — only if proof contains data
        bool eventTriggered = false;
        if (_proof.data.responseBody.abi_encoded_data.length > 0) {
            // Verify the proof using Flare's IJsonApiVerification
            IJsonApiVerification verifier = ContractRegistry.auxiliaryGetIJsonApiVerification();
            require(verifier.verifyJsonApi(_proof), "Invalid FDC proof");

            // Decode the verified response data
            uint256 apiValue = abi.decode(_proof.data.responseBody.abi_encoded_data, (uint256));
            
            // Check ALL trigger types — if ANY matches, trigger protection
            for (uint256 i = 0; i < rule.triggerTypes.length; i++) {
                TriggerType triggerType = rule.triggerTypes[i];
                uint256 dangerValue = rule.dangerValues[i];
                
                if (triggerType == TriggerType.EXCHANGE_STATUS) {
                    // Trigger when value equals danger value (e.g., maintenance mode = 1)
                    if (apiValue == dangerValue) {
                        eventTriggered = true;
                        break;
                    }
                } else if (triggerType == TriggerType.FEAR_GREED_INDEX) {
                    // Trigger when value is below danger value (e.g., index < 25 = extreme fear)
                    if (apiValue < dangerValue) {
                        eventTriggered = true;
                        break;
                    }
                } else if (triggerType == TriggerType.BTC_DOMINANCE) {
                    // Trigger when value is above danger value (e.g., BTC.D > 60%)
                    if (apiValue > dangerValue) {
                        eventTriggered = true;
                        break;
                    }
                }
            }
        }

        require(priceTriggered || eventTriggered, "Protection conditions not met");

        // 3. Swap to safety — return native tokens to user (mock swap for hackathon)
        uint256 amount = rule.depositAmount;
        rule.depositAmount = 0;
        rule.isActive = false;

        payable(rule.owner).transfer(amount);

        emit ProtectionTriggered(_ruleId, rule.owner, eventTriggered, priceTriggered);
    }

    /// @notice Check the current FTSO price for a rule's feed
    /// @return currentPrice The current price from FTSO
    /// @return decimals The decimal places for the price
    /// @return triggered Whether the price trigger condition is met
    function checkPrice(uint256 _ruleId) external view returns (uint256 currentPrice, int8 decimals, bool triggered) {
        require(_ruleId < rules.length, "Rule does not exist");
        ProtectionRule storage rule = rules[_ruleId];

        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        (currentPrice, decimals, ) = ftsoV2.getFeedById(rule.priceFeedId);
        triggered = currentPrice > 0 && currentPrice < rule.priceTrigger;
    }

    /// @notice Withdraw deposit and deactivate rule (only rule owner)
    function withdraw(uint256 _ruleId) external {
        require(_ruleId < rules.length, "Rule does not exist");
        ProtectionRule storage rule = rules[_ruleId];
        require(msg.sender == rule.owner, "Not rule owner");
        require(rule.isActive, "Rule not active");
        require(rule.depositAmount > 0, "Nothing to withdraw");

        uint256 amount = rule.depositAmount;
        rule.depositAmount = 0;
        rule.isActive = false;

        payable(msg.sender).transfer(amount);

        emit Withdrawn(_ruleId, msg.sender, amount);
    }

    /// @notice Get the total number of rules
    function ruleCount() external view returns (uint256) {
        return rules.length;
    }

    /// @notice Get all rule IDs belonging to a user
    function getUserRules(address _user) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < rules.length; i++) {
            if (rules[i].owner == _user) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < rules.length; i++) {
            if (rules[i].owner == _user) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /// @notice Read a live FTSO price feed directly (utility for frontend)
    function getFeedPrice(bytes21 _feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedById(_feedId);
    }
}
