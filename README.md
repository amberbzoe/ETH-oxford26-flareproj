# FlareGuard

## Description

FlareGuard is an automated DeFi position protection vault that combines on-chain price data (FTSO v2) with off-chain real-world event verification (FDC JsonApi) to detect danger conditions and return user deposits before liquidation occurs. Users deposit tokens, configure one or more independent protection triggers, and the vault automatically returns funds when any trigger condition is met.

### Built on Flare

**Note to Judges:** This project is part of the Flare Hackathon track.

- **Network:** Coston2 Testnet (Chain ID 114)
- **Flare Integrations:** FTSO v2 (price feeds), FDC JsonApi (off-chain event attestation)
- **Demo Link:** https://starlit-cannoli-4362df.netlify.app/

---

## Deployment Details

- **Contract Address:** [`0xBB552b05e84B300D412F38Ff6A44097D93ed4CD5`](https://coston2-explorer.flare.network/address/0xBB552b05e84B300D412F38Ff6A44097D93ed4CD5)
- **Block Explorer:** [Coston2 Explorer](https://coston2-explorer.flare.network/address/0xBB552b05e84B300D412F38Ff6A44097D93ed4CD5)

---

## How It Works

1. **Connect wallet** and deposit C2FLR into the FlareGuard vault on Coston2
2. **Configure protection triggers** — enable any combination of 4 independent safeguards:
   - **FLR Price Drop** (FTSO) — triggers when the FLR/USD price falls below a user-defined threshold
   - **Exchange Maintenance** (FDC) — triggers when the Binance system status API reports downtime (status = 1)
   - **Fear & Greed Index** (FDC) — triggers when the Crypto Fear & Greed Index drops below a user-defined threshold (e.g. < 25)
   - **Bitcoin Dominance** (FDC) — triggers when BTC market cap dominance rises above a user-defined threshold (e.g. > 60%)
3. **Any single trigger** fires → the vault returns the deposited C2FLR to the user's wallet
4. **Monitor** active protections and live FTSO prices from the frontend dashboard

---

## Flare Protocol Integration

### FTSO v2 — Price Feeds

The smart contract reads live prices from Flare's enshrined Time Series Oracle via `ContractRegistry.getTestFtsoV2()` and `getFeedById()`. No external oracle infrastructure is required.

| Feed | Feed ID | Usage |
|------|---------|-------|
| FLR/USD | `0x01464c522f55534400000000000000000000000000` | Price trigger + dashboard |
| BTC/USD | `0x014254432f55534400000000000000000000000000` | Dashboard display |
| ETH/USD | `0x014554482f55534400000000000000000000000000` | Dashboard display |
| XRP/USD | `0x015852502f55534400000000000000000000000000` | Dashboard display |

The frontend polls all 4 feeds every 5 minutes (Vercel Free-Use Sever Restrictions). For the price trigger, the contract compares the current FTSO value against the user's threshold: if `currentPrice < priceTrigger`, the condition is met.

### FDC JsonApi — Real-World Event Verification

FlareGuard uses Flare's Data Connector to bring off-chain API data on-chain with cryptographic proof, verified by independent data providers in a voting round (~90 seconds).

| Trigger | API Source | JQ Transform | Condition |
|---------|-----------|--------------|-----------|
| Exchange Status | `api.binance.com/sapi/v1/system/status` | `.status` | value == 1 |
| Fear & Greed Index | `api.alternative.me/fng/` | `.data[0].value \| tonumber` | value < threshold |
| Bitcoin Dominance | `api.coingecko.com/api/v3/global` | `.data.market_cap_percentage.btc` | value > threshold |

**Attestation flow:**
1. An FDC request is submitted to `FdcHub.requestAttestation()` with the API URL and a JQ transform
2. Data providers independently fetch and verify the API response in a voting round
3. The proof is fetched from the DA Layer (`da-layer-testnet.flare.network`)
4. The smart contract verifies the proof on-chain using `IJsonApiVerification.verifyJsonApi()`, decodes the response, and checks each trigger condition — if any match, protection executes

```solidity
// On-chain proof verification and trigger check (from FlareGuardVault.sol)
IJsonApiVerification verifier = ContractRegistry.auxiliaryGetIJsonApiVerification();
require(verifier.verifyJsonApi(_proof), "Invalid FDC proof");

uint256 apiValue = abi.decode(_proof.data.responseBody.abi_encoded_data, (uint256));
for (uint256 i = 0; i < rule.triggerTypes.length; i++) {
    if (triggerType == TriggerType.EXCHANGE_STATUS && apiValue == dangerValue) eventTriggered = true;
    if (triggerType == TriggerType.FEAR_GREED_INDEX && apiValue < dangerValue) eventTriggered = true;
    if (triggerType == TriggerType.BTC_DOMINANCE  && apiValue > dangerValue) eventTriggered = true;
}
```

Both FTSO and FDC are accessed through the same `ContractRegistry`, so the vault uses Flare's enshrined data protocols with no external oracle dependencies.

---

## Hackathon Prototype vs Production

### Current Implementation (Mock Transactions)

In this hackathon prototype, when a protection trigger fires, the vault returns the deposited native tokens (C2FLR) directly to the user's wallet via `payable(owner).transfer(amount)`. This demonstrates the full trigger pipeline — FTSO price monitoring, FDC event attestation, on-chain proof verification, and automated execution — without introducing DEX routing complexity.

```
Trigger fires → Vault transfers deposited C2FLR back to user's wallet
```

The trigger detection logic (combining FTSO price checks with FDC event verification) is fully functional. What is simplified is the response to that detection.

### Production Implementation (Stablecoin Swap)

Returning the same volatile asset does not preserve value — the asset may continue to decline after it's returned. A production version would trade the volatile collateral for a stablecoin before returning it, preserving the user's value at the moment the trigger fires.

```
Trigger fires → Vault swaps collateral (e.g. FLR → USDC) via DEX → Stablecoin sent to user's wallet
```

**How this would work:**
1. **Trigger detection** — identical to the current system (FTSO price check + FDC event verification)
2. **DEX swap** — the vault calls a DEX router to swap the volatile asset for a stablecoin, using the FTSO price feed to enforce a minimum output amount (slippage protection)
3. **Stablecoin delivery** — the resulting stablecoins are transferred to the user's wallet
4. **Re-entry** — once conditions stabilise, the user can swap back at the lower price

**Additional production considerations:**
- Slippage protection using FTSO price data to set minimum acceptable output
- Multi-asset vaults accepting ERC-20 tokens beyond native FLR
- Decentralised keeper network replacing the Vercel cron for permissionless execution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Asset       │  │  Your Vault  │  │ Active Protections │    │
│  │  Protection   │  │              │  │                    │    │
│  │  4 toggleable │  │  Deposit     │  │  Rule cards with   │    │
│  │  safeguards   │  │  Balance     │  │  test & withdraw   │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│           │                │                    │               │
│           └────────────────┼────────────────────┘               │
│                            │ ethers.js v6                       │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│              FlareGuardVault.sol (Coston2)                      │
│                            │                                    │
│    ┌───────────────┐  ┌────┴─────┐  ┌─────────────────────┐    │
│    │ FTSO v2       │  │ Vault    │  │ FDC JsonApi         │    │
│    │ Price feeds   │  │ Logic    │  │ Event verification  │    │
│    │ via Contract  │  │ Deposit  │  │ via IJsonApi        │    │
│    │ Registry      │  │ Withdraw │  │ Verification        │    │
│    │               │  │ Execute  │  │                     │    │
│    └───────────────┘  └──────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│              Keeper Service (Vercel Cron — every 5 min)         │
│    Monitors FTSO prices → Triggers protections automatically   │
│    Submits FDC requests → Fetches proofs → Executes on-chain   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.27, Hardhat, `@flarenetwork/flare-periphery-contracts`, OpenZeppelin |
| **Frontend** | React 19, TypeScript, Vite, Ethers.js v6, Framer Motion, Lucide Icons |
| **Automation** | Vercel Serverless Functions + Cron (5-minute intervals) |
| **Blockchain** | Flare Coston2 Testnet (Chain ID 114) |
| **Data Protocols** | FTSO v2 (price feeds), FDC JsonApi (off-chain attestation) |

---

## Project Structure

```
├── contracts/
│   ├── contracts/
│   │   └── FlareGuardVault.sol          # Core vault with FTSO + FDC integration
│   ├── scripts/
│   │   ├── deploy.ts                    # Deploy to Coston2
│   │   ├── checkFtsoPrice.ts            # Query live FTSO price feeds
│   │   ├── submitFdcRequest.ts          # Submit FDC attestation (Binance status)
│   │   ├── submitFearGreedRequest.ts    # Submit FDC attestation (Fear & Greed)
│   │   └── fetchProofAndExecute.ts      # Fetch DA Layer proof & execute protection
│   ├── hardhat.config.ts
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      # Main 3-panel dashboard
│   │   ├── components/Header.tsx        # Navbar, live FTSO prices, help guide
│   │   ├── hooks/useWallet.ts           # MetaMask connection + Coston2 network
│   │   ├── hooks/useContract.ts         # ethers.js contract instance
│   │   ├── config/contract.ts           # Contract address, feed IDs, ABI
│   │   └── index.css                    # Glassmorphism design system
│   ├── api/cron.ts                      # Vercel keeper service
│   └── .env.example
├── LICENSE
└── README.md
```

---

## Installation & Setup

### Prerequisites

- Node.js v18+
- MetaMask with [Coston2 testnet](https://dev.flare.network/network/overview#coston2) configured
- Test C2FLR from the [Coston2 faucet](https://faucet.flare.network/coston2)

### Step-by-Step

**1. Clone the repo:**

```bash
git clone https://github.com/amberbzoe/ETH-oxford26-flareproj.git
```

**2. Smart Contracts — install, compile, and deploy:**

```bash
cd contracts
npm install

# Compile
npx hardhat compile

# Configure environment
cp .env.example .env   # then add your private key

# Deploy to Coston2
npx hardhat run scripts/deploy.ts --network coston2

# (Optional) Check live FTSO prices
npx hardhat run scripts/checkFtsoPrice.ts --network coston2
```

**3. Frontend — install and run:**

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env   # then add your keeper private key

npm run dev
```

If redeploying the contract, update `frontend/src/config/contract.ts` with the new contract address.

**4. FDC Attestation Flow (manual):**

```bash
# Submit an FDC JsonApi request (e.g. Binance system status)
npx hardhat run scripts/submitFdcRequest.ts --network coston2

# Wait ~3 minutes for the voting round to finalise

# Fetch proof from the DA Layer and execute protection
VAULT_ADDRESS=0x... npx hardhat run scripts/fetchProofAndExecute.ts --network coston2 -- <roundId> <ruleId> <abiEncodedRequest>
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `PRIVATE_KEY` | `contracts/.env` | Wallet key for deploying contracts via Hardhat |
| `VAULT_ADDRESS` | `contracts/.env` | Deployed FlareGuardVault address for FDC scripts |
| `KEEPER_PRIVATE_KEY` | `frontend/.env` | Wallet key for the Vercel keeper cron service |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
