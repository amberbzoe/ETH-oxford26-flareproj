// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import {IJsonApi} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApi.sol";
import {IJsonApiVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IJsonApiVerification.sol";

contract FlareGuardVault {

    struct ProtectionRule {
        address owner;
        uint256 depositAmount;
        bytes21 priceFeedId;        // FTSO feed ID (e.g. FLR/USD, XRP/USD)
        uint256 priceTrigger;       // Price threshold — protect if price drops below this
        uint256 dangerValue;        // FDC event value that triggers protection (e.g. 1 = maintenance)
        bool isActive;
    }

    struct MultiConditionRule {
        address owner;
        uint256 depositAmount;
        bytes21[] priceFeedIds;     // Multiple FTSO feed IDs
        uint256[] priceTriggers;    // Price thresholds (one per feed)
        uint256[] dangerValues;     // FDC danger values (one per event type)
        bool isActive;
    }

    ProtectionRule[] public rules;
    MultiConditionRule[] public multiConditionRules;

    // Common FTSO feed IDs
    bytes21 public constant FLR_USD_FEED_ID = bytes21(0x01464c522f55534400000000000000000000000000);
    bytes21 public constant XRP_USD_FEED_ID = bytes21(0x015852502f55534400000000000000000000000000);
    bytes21 public constant BTC_USD_FEED_ID = bytes21(0x014254432f55534400000000000000000000000000);
    bytes21 public constant ETH_USD_FEED_ID = bytes21(0x014554482f55534400000000000000000000000000);

    event RuleCreated(uint256 indexed ruleId, address indexed owner, uint256 depositAmount, uint256 priceTrigger);
    event MultiConditionRuleCreated(uint256 indexed ruleId, address indexed owner, uint256 depositAmount, uint256 feedCount, uint256 eventCount);
    event ProtectionTriggered(uint256 indexed ruleId, address indexed owner, bool eventTrigger, bool priceTrigger);
    event MultiConditionProtectionTriggered(uint256 indexed ruleId, address indexed owner, string triggerType);
    event Withdrawn(uint256 indexed ruleId, address indexed owner, uint256 amount);

    receive() external payable {}

    /// @notice Create a protection rule and deposit native tokens into the vault
    /// @param _priceFeedId FTSO feed ID to monitor
    /// @param _priceTrigger Price threshold — if feed value drops below this, trigger protection
    /// @param _dangerValue FDC event value that indicates danger (e.g. 1 = exchange maintenance)
    function createRule(
        bytes21 _priceFeedId,
        uint256 _priceTrigger,
        uint256 _dangerValue
    ) external payable {
        require(msg.value > 0, "Must deposit tokens");

        uint256 ruleId = rules.length;
        rules.push(ProtectionRule({
            owner: msg.sender,
            depositAmount: msg.value,
            priceFeedId: _priceFeedId,
            priceTrigger: _priceTrigger,
            dangerValue: _dangerValue,
            isActive: true
        }));

        emit RuleCreated(ruleId, msg.sender, msg.value, _priceTrigger);
    }

    /// @notice Create a multi-condition protection rule
    /// @dev Users can set multiple price feeds and/or events. Any single trigger protects entire collateral.
    /// @param _priceFeedIds Array of FTSO feed IDs to monitor
    /// @param _priceTriggers Array of price thresholds (one per feed)
    /// @param _dangerValues Array of FDC danger values
    function createMultiConditionRule(
        bytes21[] calldata _priceFeedIds,
        uint256[] calldata _priceTriggers,
        uint256[] calldata _dangerValues
    ) external payable {
        require(msg.value > 0, "Must deposit tokens");
        require(_priceFeedIds.length > 0 || _dangerValues.length > 0, "At least one condition required");
        require(_priceFeedIds.length == _priceTriggers.length, "Feed/trigger array mismatch");

        uint256 ruleId = multiConditionRules.length;
        
        MultiConditionRule storage rule = multiConditionRules.push();
        rule.owner = msg.sender;
        rule.depositAmount = msg.value;
        rule.isActive = true;

        // Copy arrays into storage
        for (uint256 i = 0; i < _priceFeedIds.length; i++) {
            rule.priceFeedIds.push(_priceFeedIds[i]);
            rule.priceTriggers.push(_priceTriggers[i]);
        }
        for (uint256 i = 0; i < _dangerValues.length; i++) {
            rule.dangerValues.push(_dangerValues[i]);
        }

        emit MultiConditionRuleCreated(ruleId, msg.sender, msg.value, _priceFeedIds.length, _dangerValues.length);
    }

    /// @notice Execute multi-condition protection (ANY condition triggers full protection)
    /// @param _ruleId The multi-condition rule to execute
    /// @param _proof FDC proof (optional, for event trigger)
    function executeMultiConditionProtection(uint256 _ruleId, IJsonApi.Proof calldata _proof) external {
        require(_ruleId < multiConditionRules.length, "Multi-condition rule does not exist");
        MultiConditionRule storage rule = multiConditionRules[_ruleId];
        require(rule.isActive, "Rule not active");
        require(rule.depositAmount > 0, "No deposit");

        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        bool conditionMet = false;
        string memory triggerType = "";

        // Check ANY price condition
        for (uint256 i = 0; i < rule.priceFeedIds.length; i++) {
            (uint256 currentPrice, , ) = ftsoV2.getFeedById(rule.priceFeedIds[i]);
            if (currentPrice > 0 && currentPrice < rule.priceTriggers[i]) {
                conditionMet = true;
                triggerType = "price";
                break;
            }
        }

        // Check ANY event condition (if proof provided)
        if (!conditionMet && _proof.data.responseBody.abi_encoded_data.length > 0) {
            IJsonApiVerification verifier = ContractRegistry.auxiliaryGetIJsonApiVerification();
            if (verifier.verifyJsonApi(_proof)) {
                uint256 apiValue = abi.decode(_proof.data.responseBody.abi_encoded_data, (uint256));
                for (uint256 i = 0; i < rule.dangerValues.length; i++) {
                    if (apiValue == rule.dangerValues[i]) {
                        conditionMet = true;
                        triggerType = "event";
                        break;
                    }
                }
            }
        }

        require(conditionMet, "No condition triggered");

        // Return ENTIRE collateral
        uint256 amount = rule.depositAmount;
        rule.depositAmount = 0;
        rule.isActive = false;

        payable(rule.owner).transfer(amount);

        emit MultiConditionProtectionTriggered(_ruleId, rule.owner, triggerType);
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
            eventTriggered = (apiValue == rule.dangerValue);
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

    /// @notice Get all multi-condition rule IDs belonging to a user
    function getUserMultiConditionRules(address _user) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < multiConditionRules.length; i++) {
            if (multiConditionRules[i].owner == _user) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < multiConditionRules.length; i++) {
            if (multiConditionRules[i].owner == _user) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /// @notice Withdraw from multi-condition rule
    function withdrawMultiCondition(uint256 _ruleId) external {
        require(_ruleId < multiConditionRules.length, "Rule does not exist");
        MultiConditionRule storage rule = multiConditionRules[_ruleId];
        require(msg.sender == rule.owner, "Not rule owner");
        require(rule.isActive, "Rule not active");
        require(rule.depositAmount > 0, "Nothing to withdraw");

        uint256 amount = rule.depositAmount;
        rule.depositAmount = 0;
        rule.isActive = false;

        payable(msg.sender).transfer(amount);

        emit Withdrawn(_ruleId, msg.sender, amount);
    }

    /// @notice Read a live FTSO price feed directly (utility for frontend)
    function getFeedPrice(bytes21 _feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedById(_feedId);
    }
}
