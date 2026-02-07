// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

interface IFlareDataConnector {
    /**
     * @notice Verify a proof against the current state of a connector.
     * @param _proof The detailed proof data to verify.
     * @return bool True if the proof is valid.
     */
    function verify(bytes calldata _proof) external view returns (bool);
}
