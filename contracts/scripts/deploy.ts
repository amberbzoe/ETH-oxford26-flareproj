import { ethers } from "hardhat";

async function main() {
    // Address of FTSO Registry on Coston2 Testnet
    const FTSO_REGISTRY_ADDR = "0x48752F229a1ef6D9422953C88746FB22B6906bfd";

    const FlareGuardVault = await ethers.getContractFactory("FlareGuardVault");
    const vault = await FlareGuardVault.deploy(FTSO_REGISTRY_ADDR);

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
