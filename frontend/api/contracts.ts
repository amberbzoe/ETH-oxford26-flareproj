import { ethers } from 'ethers';

// Helper to get initialized contract
export async function getVaultContract(signerOrProvider: any) {
    // Address of our deployed Vault on Coston2
    const VAULT_ADDRESS = "YOUR_DEPLOYED_VAULT_ADDRESS_HERE";

    // ABI (minimal interface for what we need)
    const VAULT_ABI = [
        "function executeProtection(address _user, bytes calldata _fdcProof) external",
        "function protectionRules(address) view returns (address, uint256, bool)",
        "function deposits(address) view returns (uint256)"
    ];

    return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signerOrProvider);
}

// Helper to get FTSO Registry for checking prices remotely
export async function getFtsoRegistry(provider: any) {
    const FTSO_REGISTRY_ADDR = "0x48752F229a1ef6D9422953C88746FB22B6906bfd";
    const ABI = [
        "function getCurrentPrice(string memory _symbol) external view returns (uint256 _price, uint256 _timestamp)",
        "function getCurrentPriceWithDecimals(string memory _symbol) external view returns (uint256 _price, uint256 _timestamp, uint256 _assetPriceDecimals)"
    ];
    return new ethers.Contract(FTSO_REGISTRY_ADDR, ABI, provider);
}
