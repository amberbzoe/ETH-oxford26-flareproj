import { ethers } from "hardhat";
import axios from "axios";

const CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
const VERIFIER_URL = "https://fdc-verifiers-testnet.flare.network";

// JsonApi attestation type as bytes32 (UTF8 "JsonApi" padded to 32 bytes)
const JSON_API_ATTESTATION_TYPE = ethers.encodeBytes32String("JsonApi");
// Source ID for Web2 data (UTF8 "WEB2" padded to 32 bytes)
const WEB2_SOURCE_ID = ethers.encodeBytes32String("WEB2");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Submitting Fear & Greed Index FDC request with account:", signer.address);

    // Step 1: Prepare the JsonApi attestation request
    // We'll check the Crypto Fear & Greed Index from Alternative.me
    // API returns: { "data": [{ "value": "45", "value_classification": "Fear" }] }
    console.log("\n--- Preparing FDC JsonApi Attestation for Fear & Greed Index ---\n");

    const requestBody = {
        url: "https://api.alternative.me/fng/",
        postprocessJq: ".data[0].value | tonumber",
        abi_signature: '{"components": [{"name": "fearGreedIndex", "type": "uint256"}], "name": "task", "type": "tuple"}'
    };

    console.log("API URL:", requestBody.url);
    console.log("JQ Filter:", requestBody.postprocessJq);
    console.log("ABI Signature:", requestBody.abi_signature);

    // Call the verifier to prepare the attestation request with MIC
    let abiEncodedRequest: string;
    try {
        const prepareResponse = await axios.post(
            `${VERIFIER_URL}/verifier/jsonapi/prepareAttestation`,
            {
                attestationType: JSON_API_ATTESTATION_TYPE,
                sourceId: WEB2_SOURCE_ID,
                requestBody: requestBody
            },
            { headers: { "Content-Type": "application/json" } }
        );
        abiEncodedRequest = prepareResponse.data.abiEncodedRequest;
        console.log("\nABI Encoded Request:", abiEncodedRequest.substring(0, 66) + "...");
    } catch (e: any) {
        console.error("Failed to prepare attestation:", e.response?.data || e.message);
        process.exit(1);
    }

    // Step 2: Get the attestation fee
    const registry = new ethers.Contract(
        CONTRACT_REGISTRY,
        ["function getContractAddressByName(string) view returns (address)"],
        signer
    );

    const feeConfigAddr = await registry.getContractAddressByName("FdcRequestFeeConfigurations");
    const feeConfig = new ethers.Contract(
        feeConfigAddr,
        ["function getRequestFee(bytes) view returns (uint256)"],
        signer
    );

    let fee: bigint;
    try {
        fee = await feeConfig.getRequestFee(abiEncodedRequest);
        console.log("Attestation fee:", ethers.formatEther(fee), "FLR");
    } catch {
        // If fee lookup fails, use a reasonable default
        fee = ethers.parseEther("0.5");
        console.log("Fee lookup failed, using default:", ethers.formatEther(fee), "FLR");
    }

    // Step 3: Submit to FdcHub
    const fdcHubAddr = await registry.getContractAddressByName("FdcHub");
    console.log("FdcHub address:", fdcHubAddr);

    const fdcHub = new ethers.Contract(
        fdcHubAddr,
        ["function requestAttestation(bytes) payable"],
        signer
    );

    console.log("\nSubmitting attestation request...");
    const tx = await fdcHub.requestAttestation(abiEncodedRequest, { value: fee });
    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt.hash);
    console.log("Block number:", receipt.blockNumber);

    // Step 4: Calculate the voting round ID
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block!.timestamp;

    console.log("\n--- FDC Request Submitted Successfully ---");
    console.log("Block timestamp:", timestamp);
    console.log("ABI Encoded Request (save for proof fetch):", abiEncodedRequest);
    console.log("\n--- Fear & Greed Index Info ---");
    console.log("The Fear & Greed Index ranges from 0-100:");
    console.log("  0-24:  Extreme Fear (good buy signal)");
    console.log("  25-49: Fear");
    console.log("  50-54: Neutral");
    console.log("  55-74: Greed");
    console.log("  75-100: Extreme Greed (good sell signal)");
    console.log("\nFor protection rules, set dangerValue to your threshold.");
    console.log("Example: dangerValue=25 triggers when index drops below 25 (Extreme Fear)");
    console.log("\nNext: Wait ~3 minutes for voting round to complete,");
    console.log("then run fetchProofAndExecute.ts with the abiEncodedRequest");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
