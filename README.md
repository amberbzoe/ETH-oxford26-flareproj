# FlareGuard

**Automated DeFi position protection powered by Flare's enshrined oracles.**

People lost $2.3 billion to DeFi liquidations last year. FlareGuard prevents them by reacting to real-world events — not just price — using Flare's enshrined data protocols.

## How It Works

1. User connects wallet and deposits tokens into the FlareGuard vault
2. User sets protection rules with dual triggers:
   - **Price trigger** (via FTSO): "If FLR < $0.02, protect me"
   - **Event trigger** (via FDC JsonApi): "If Binance goes into maintenance mode, protect me"
3. When either trigger fires, the vault automatically returns tokens to the user's wallet
4. Users wake up to their assets intact instead of a liquidation notice

## Flare Protocols Used

| Protocol | Purpose | How We Use It |
|----------|---------|---------------|
| **FTSO v2** | Decentralized price feeds | Live price monitoring with configurable thresholds |
| **FDC JsonApi** | Real-world event verification | Checks Web2 APIs (e.g. exchange status) via ~100 data providers |
| **FAssets (FXRP)** | Synthetic wrapped assets | Primary protected asset class in the XRPFi ecosystem |

## Tech Stack

- **Blockchain**: Flare Network (Coston2 Testnet)
- **Smart Contracts**: Solidity 0.8.27, Hardhat, `@flarenetwork/flare-periphery-contracts`
- **Frontend**: React 19, Vite, TypeScript, Ethers.js v6
- **Off-chain**: FDC attestation scripts (submit request, fetch proof, execute)

## Setup

### Prerequisites
- Node.js v18+
- MetaMask with [Coston2 testnet](https://dev.flare.network/network/overview#coston2) configured
- Test C2FLR from [faucet](https://faucet.flare.network/coston2)

### Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile

# Deploy to Coston2 (requires PRIVATE_KEY in .env)
npx hardhat run scripts/deploy.ts --network coston2

# Check live FTSO prices
npx hardhat run scripts/checkFtsoPrice.ts --network coston2
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Update `frontend/src/config/contract.ts` with the deployed contract address.

### FDC Attestation Flow
```bash
# 1. Submit FDC JsonApi request (hits Binance status API)
npx hardhat run scripts/submitFdcRequest.ts --network coston2

# 2. Wait ~3 minutes for voting round to complete

# 3. Fetch proof from DA Layer and execute protection
VAULT_ADDRESS=0x... npx hardhat run scripts/fetchProofAndExecute.ts --network coston2 -- <roundId> <ruleId> <abiEncodedRequest>
```

## Demo Script

> FlareGuard is live on Coston2. I've set up a protection rule that monitors
> Binance's system status via FDC's JsonApi, combined with an FTSO price threshold.
>
> When I trigger the check, ~100 data providers independently verify the API
> endpoint... the proof comes back in about 3 minutes... and the user's tokens
> are returned to safety. All verified on-chain, trustlessly.
>
> In production, this runs automatically via keeper services. For this demo, we
> trigger manually to show the full FDC consensus flow.

## Developer Feedback (Flare Integration)

FDC documentation was solid for EVM transaction attestations but we struggled to find examples for custom Web2 API attestations with JQ transforms. We ended up using real JsonApi attestations on Coston2 for our demo and would love to see a cookbook-style guide for common Web2 data patterns (REST API to attestation to on-chain verification). The FTSO integration was smooth — the `@flarenetwork/flare-periphery-contracts` package got us reading price feeds in under 30 minutes using `ContractRegistry.getTestFtsoV2()`. We'd suggest adding a section in docs about combining FTSO + FDC in the same contract, since this multi-protocol pattern is where Flare's real value shines. The `IJsonApiVerification` interface via `auxiliaryGetIJsonApiVerification()` worked well once we found it, but the naming split between `IJsonApi`/`IWeb2Json` was initially confusing. Overall, building on Flare was a positive experience — the enshrined oracles remove the need for any external oracle dependencies, which is a significant architectural advantage.

## License
MIT
