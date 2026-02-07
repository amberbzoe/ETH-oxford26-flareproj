import { ethers } from "hardhat";
import axios from "axios";

const DA_LAYER_URL = "https://da-layer-testnet.flare.network";

// FlareGuardVault deployed address (update after deployment)
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";

async function main() {
    // Parse CLI args: roundId, ruleId, abiEncodedRequest
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log("Usage: npx hardhat run scripts/fetchProofAndExecute.ts --network coston2 -- <roundId> <ruleId> <abiEncodedRequest>");
        console.log("\nExample:");
        console.log("  npx hardhat run scripts/fetchProofAndExecute.ts --network coston2 -- 12345 0 0xabcdef...");
        process.exit(1);
    }

    const roundId = parseInt(args[0]);
    const ruleId = parseInt(args[1]);
    const abiEncodedRequest = args[2];

    if (!VAULT_ADDRESS) {
        console.error("Set VAULT_ADDRESS environment variable to the deployed FlareGuardVault address");
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log("Fetching proof and executing with account:", signer.address);

    // Step 1: Fetch proof from DA Layer
    console.log("\n--- Fetching FDC Proof from DA Layer ---");
    console.log("Voting Round ID:", roundId);

    let proofData: any;
    try {
        const response = await axios.post(
            `${DA_LAYER_URL}/api/v0/fdc/get-proof-round-id-bytes`,
            {
                votingRoundId: roundId,
                requestBytes: abiEncodedRequest
            },
            {
                headers: { "Content-Type": "application/json" }
            }
        );
        proofData = response.data;
        console.log("Proof received successfully");
    } catch (e: any) {
        console.error("Failed to fetch proof:", e.response?.data || e.message);
        console.log("\nThe voting round may not be finalized yet. Try again in a few minutes.");
        process.exit(1);
    }

    // Step 2: Format the proof for the contract
    // The proof struct matches IJsonApi.Proof: { merkleProof: bytes32[], data: Response }
    const proof = {
        merkleProof: proofData.merkleProof || [],
        data: {
            attestationType: proofData.response?.attestationType || ethers.ZeroHash,
            sourceId: proofData.response?.sourceId || ethers.ZeroHash,
            votingRound: proofData.response?.votingRound || 0,
            lowestUsedTimestamp: proofData.response?.lowestUsedTimestamp || 0,
            requestBody: {
                url: proofData.response?.requestBody?.url || "",
                postprocessJq: proofData.response?.requestBody?.postprocessJq || "",
                abi_signature: proofData.response?.requestBody?.abi_signature || ""
            },
            responseBody: {
                abi_encoded_data: proofData.response?.responseBody?.abi_encoded_data || "0x"
            }
        }
    };

    console.log("\n--- Executing Protection ---");
    console.log("Rule ID:", ruleId);

    // Step 3: Call executeProtection on the vault
    const vault = await ethers.getContractAt("FlareGuardVault", VAULT_ADDRESS, signer);

    try {
        const tx = await vault.executeProtection(ruleId, proof);
        const receipt = await tx.wait();
        console.log("Protection executed! TX hash:", receipt.hash);

        // Parse events
        for (const log of receipt.logs) {
            try {
                const parsed = vault.interface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed && parsed.name === "ProtectionTriggered") {
                    console.log("\nProtection Triggered:");
                    console.log("  Rule ID:", parsed.args.ruleId.toString());
                    console.log("  Owner:", parsed.args.owner);
                    console.log("  Event Trigger:", parsed.args.eventTrigger);
                    console.log("  Price Trigger:", parsed.args.priceTrigger);
                }
            } catch { /* not our event */ }
        }
    } catch (e: any) {
        console.error("Execution failed:", e.reason || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
