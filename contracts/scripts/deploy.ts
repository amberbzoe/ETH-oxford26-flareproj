import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying FlareGuardVault with account:", deployer.address);

    const FlareGuardVault = await ethers.getContractFactory("FlareGuardVault");
    const vault = await FlareGuardVault.deploy();
    await vault.waitForDeployment();

    const address = await vault.getAddress();
    console.log(`FlareGuardVault deployed to: ${address}`);
    console.log(`\nVerify on explorer: https://coston2-explorer.flare.network/address/${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
