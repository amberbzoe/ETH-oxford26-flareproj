// FlareGuardVault contract configuration
// Update VAULT_ADDRESS after deploying to Coston2

export const VAULT_ADDRESS = "0x31A22e4abbdBa1b6067567E90Bf27391931b60F4"; // Deployed to Coston2

export const COSTON2_CHAIN_ID = 114;
export const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
export const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";

export const COSTON2_NETWORK = {
    chainId: "0x72", // 114 in hex
    chainName: "Flare Testnet Coston2",
    nativeCurrency: { name: "Coston2 FLR", symbol: "C2FLR", decimals: 18 },
    rpcUrls: [COSTON2_RPC],
    blockExplorerUrls: [COSTON2_EXPLORER],
};

// Common FTSO v2 feed IDs
export const FEED_IDS: Record<string, string> = {
    "FLR/USD": "0x01464c522f55534400000000000000000000000000",
    "XRP/USD": "0x015852502f55534400000000000000000000000000",
    "BTC/USD": "0x014254432f55534400000000000000000000000000",
    "ETH/USD": "0x014554482f55534400000000000000000000000000",
};

// FDC event presets for the dropdown
// triggerType: 0 = EXCHANGE_STATUS (equals), 1 = FEAR_GREED_INDEX (below threshold), 2 = BTC_DOMINANCE (above threshold)
export const FDC_EVENT_PRESETS = [
    {
        label: "Binance System Maintenance",
        apiUrl: "https://api.binance.com/sapi/v1/system/status",
        jqFilter: ".status",
        dangerValue: 1,
        triggerType: 0  // EXCHANGE_STATUS: triggers when value == dangerValue
    },
    {
        label: "Fear & Greed Index Below Threshold",
        apiUrl: "https://api.alternative.me/fng/",
        jqFilter: ".data[0].value | tonumber",
        dangerValue: 25,  // Default: Extreme Fear threshold
        triggerType: 1    // FEAR_GREED_INDEX: triggers when value < dangerValue
    },
    {
        label: "Bitcoin Dominance Above Threshold",
        apiUrl: "https://api.coingecko.com/api/v3/global",
        jqFilter: ".data.market_cap_percentage.btc",
        dangerValue: 60,  // Default: 60% BTC dominance threshold
        triggerType: 2    // BTC_DOMINANCE: triggers when value > dangerValue
    },
];

export const VAULT_ABI = [
    "function createRule(bytes21 _priceFeedId, uint256 _priceTrigger, uint8[] memory _triggerTypes, uint256[] memory _dangerValues) external payable",
    "function executeProtection(uint256 _ruleId, tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(string url, string postprocessJq, string abi_signature) requestBody, tuple(bytes abi_encoded_data) responseBody) data) _proof) external",
    "function checkPrice(uint256 _ruleId) external view returns (uint256 currentPrice, int8 decimals, bool triggered)",
    "function withdraw(uint256 _ruleId) external",
    "function ruleCount() external view returns (uint256)",
    "function rules(uint256) external view returns (address owner, uint256 depositAmount, bytes21 priceFeedId, uint256 priceTrigger, bool isActive)",
    "function getUserRules(address _user) external view returns (uint256[])",
    "function getFeedPrice(bytes21 _feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp)",
    "function FLR_USD_FEED_ID() external view returns (bytes21)",
    "function XRP_USD_FEED_ID() external view returns (bytes21)",
    "event RuleCreated(uint256 indexed ruleId, address indexed owner, uint256 depositAmount, uint256 priceTrigger)",
    "event ProtectionTriggered(uint256 indexed ruleId, address indexed owner, bool eventTrigger, bool priceTrigger)",
    "event Withdrawn(uint256 indexed ruleId, address indexed owner, uint256 amount)",
];
