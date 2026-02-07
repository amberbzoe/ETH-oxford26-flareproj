// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IFlareDataConnector.sol";

contract MockFDC is IFlareDataConnector {
    // For demo purposes, we allow anyone to set whether a proof is valid
    // In reality, this would verify cryptographic proofs from the Flare attestation providers
    mapping(bytes32 => bool) public validProofs;

    function setProofValidity(bytes calldata _proof, bool _isValid) external {
        validProofs[keccak256(_proof)] = _isValid;
    }

    function verify(bytes calldata _proof) external view override returns (bool) {
        return validProofs[keccak256(_proof)];
    }
}
