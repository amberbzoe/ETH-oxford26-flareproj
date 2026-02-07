import { ethers } from "hardhat";

async function main() {
    // Address of FTSO Registry on Coston2 Testnet
    const FTSO_REGISTRY_ADDR = "0x48752F229a1ef6D9422953C88746FB22B6906bfd";
    // Mock FDC Address for now (We will deploy a Mock if needed or find the real one)
    // For Hackathon, we can use a placeholder or deploy a mock FDC.
    // Let's deploy a Mock FDC for testing purposes since verifying real proofs on testnet without a relayer is hard.

    const MockFDC = await ethers.getContractFactory("MockFDC");
    const mockFDC = await MockFDC.deploy();
    await mockFDC.waitForDeployment();
    console.log(`MockFDC deployed to ${await mockFDC.getAddress()}`);

    const FlareGuardVault = await ethers.getContractFactory("FlareGuardVault");
    const vault = await FlareGuardVault.deploy(FTSO_REGISTRY_ADDR, await mockFDC.getAddress());

    await vault.waitForDeployment();

    console.log(
        `FlareGuardVault deployed to ${await vault.getAddress()}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
