import { ethers } from "hardhat";

// Common FTSO v2 feed IDs
const FEED_IDS: Record<string, string> = {
    "FLR/USD": "0x01464c522f55534400000000000000000000000000",
    "XRP/USD": "0x015852502f55534400000000000000000000000000",
    "BTC/USD": "0x014254432f55534400000000000000000000000000",
    "ETH/USD": "0x014554482f55534400000000000000000000000000",
};

// ContractRegistry address (same on all Flare networks)
const CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

async function main() {
    const provider = ethers.provider;

    // Get FtsoV2 address from ContractRegistry
    const registry = new ethers.Contract(
        CONTRACT_REGISTRY,
        ["function getContractAddressByName(string) view returns (address)"],
        provider
    );
    const ftsoV2Addr = await registry.getContractAddressByName("FtsoV2");
    console.log("FtsoV2 address:", ftsoV2Addr);

    // Create FtsoV2 interface
    const ftsoV2 = new ethers.Contract(
        ftsoV2Addr,
        ["function getFeedById(bytes21) view returns (uint256, int8, uint64)"],
        provider
    );

    // Read all feeds
    console.log("\n--- FTSO v2 Price Feeds (Coston2) ---\n");
    for (const [name, feedId] of Object.entries(FEED_IDS)) {
        try {
            const [value, decimals, timestamp] = await ftsoV2.getFeedById(feedId);
            const price = Number(value) / Math.pow(10, Number(decimals));
            const time = new Date(Number(timestamp) * 1000).toISOString();
            console.log(`${name}: $${price.toFixed(6)} (decimals: ${decimals}, raw: ${value}, updated: ${time})`);
        } catch (e: any) {
            console.log(`${name}: Error reading feed - ${e.message}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
