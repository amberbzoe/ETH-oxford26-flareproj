import { ethers } from "hardhat";

async function main() {
    const FlareGuardVault = await ethers.getContractFactory("FlareGuardVault");
    const vault = await FlareGuardVault.deploy();

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
