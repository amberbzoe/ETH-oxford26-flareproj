// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

interface IFtsoRegistry {
    /**
     * @notice Returns current price of the requested token.
     * @param _symbol Symbol of the token, e.g. "XRP", "FLR", "BTC".
     * @return _price Price of the token in decimals.
     * @return _timestamp Timestamp of the price.
     */
    function getCurrentPrice(string memory _symbol) external view returns (uint256 _price, uint256 _timestamp);

    /**
     * @notice Returns current price of the requested token and its decimals.
     * @param _symbol Symbol of the token, e.g. "XRP", "FLR", "BTC".
     * @return _price Price of the token.
     * @return _timestamp Timestamp of the price.
     * @return _assetPriceDecimals Decimals of the price.
     */
    function getCurrentPriceWithDecimals(
        string memory _symbol
    ) external view returns (uint256 _price, uint256 _timestamp, uint256 _assetPriceDecimals);
}
