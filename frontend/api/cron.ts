import { ethers } from 'ethers';
import { getVaultContract, getFtsoRegistry } from './contracts';

// This function acts as a CRON JOB.
// Vercel Cron runs this every 5 minutes.
export async function GET(request: Request) {
    try {
        // 1. Setup Provider (Coston2 Testnet)
        const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");

        // 2. Setup Wallet (Keeper)
        const privateKey = process.env.KEEPER_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
        const keeper = new ethers.Wallet(privateKey, provider);

        const vault = await getVaultContract(keeper);
        const ftso = await getFtsoRegistry(provider);

        // 3. Get Price from FTSO
        const [price, , decimals] = await ftso.getCurrentPriceWithDecimals("WNAT");
        console.log(`Current FTSO Price (WNAT): ${ethers.formatUnits(price, decimals)}`);

        // 4. Check Users
        const usersToCheck = ["0xUserAddress1", "0xUserAddress2"];
        let triggeredCount = 0;

        for (const user of usersToCheck) {
            const rule = await vault.protectionRules(user);
            const isActive = rule[2];
            const threshold = rule[1];

            if (isActive && price < threshold) {
                console.log(`❌ Price Trigger for ${user}! executing swap...`);
                // Execute Transaction
                // const tx = await vault.executeProtection(user, "0x");
                // await tx.wait();
                triggeredCount++;
            }
        }

        // 5. NEW: Trigger FDC Protocol asynchronously
        triggerFDCProtocol().catch(error => {
            console.error("FDC Protocol error:", error);
        });

        // Return immediately without waiting for FDC
        return new Response(JSON.stringify({
            success: true,
            price: ethers.formatUnits(price, decimals),
            triggered: triggeredCount,
            fdc_status: "triggered in background"
        }), {
            headers: { 'content-type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

// NEW: Separate function for FDC protocol (runs in background, doesn't block response)
async function triggerFDCProtocol() {
    console.log("Starting FDC Protocol (this may take ~3 minutes)...");
    
    try {
        // TODO: Add your FDC protocol implementation here
        // This could involve:
        // - Fetching FDC data
        // - Processing it
        // - Submitting proofs to the vault
        // - etc.
        
        console.log("FDC Protocol completed successfully");
    } catch (error) {
        console.error("FDC Protocol failed:", error);
    }
}