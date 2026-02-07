import { ethers } from 'ethers';
import { getVaultContract, getFtsoRegistry } from './contracts';

// This function acts as a CRON JOB.
// Vercel Cron can call this every 1-5 minutes.
export async function GET(request: Request) {
    try {
        // 1. Setup Provider (Coston2 Testnet)
        const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");

        // 2. Setup Wallet (Keeper)
        // In production, use private key from env: process.env.KEEPER_PRIVATE_KEY
        // For hackathon demo, we can use a burner wallet or just simulation
        const privateKey = process.env.KEEPER_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;
        const keeper = new ethers.Wallet(privateKey, provider);

        const vault = await getVaultContract(keeper);
        const ftso = await getFtsoRegistry(provider);

        // 3. Get Price from FTSO
        const [price, , decimals] = await ftso.getCurrentPriceWithDecimals("WNAT");
        console.log(`Current FTSO Price (WNAT): ${ethers.formatUnits(price, decimals)}`);

        // 4. Check Users (Simulated List for Hackathon)
        // In prod, we'd fetch active users from an indexer or subgraph
        const usersToCheck = ["0xUserAddress1", "0xUserAddress2"];
        let triggeredCount = 0;

        for (const user of usersToCheck) {
            const rule = await vault.protectionRules(user);
            const isActive = rule[2]; // rule.active
            const threshold = rule[1]; // rule.priceThreshold

            if (isActive && price < threshold) {
                console.log(`❌ Price Trigger for ${user}! executing swap...`);
                // Execute Transaction
                // const tx = await vault.executeProtection(user, "0x");
                // await tx.wait();
                triggeredCount++;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            price: ethers.formatUnits(price, decimals),
            triggered: triggeredCount
        }), {
            headers: { 'content-type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
