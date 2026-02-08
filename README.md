# FlareGuard — Automated DeFi Position Protection

**Protect your assets before liquidation hits — powered by Flare's enshrined oracles.**

DeFi users lost over **$2.3 billion to liquidations** in 2024 alone. Most protection tools react only to price movements, but real-world events — exchange outages, market panic, macro shifts — often trigger cascading liquidations before price oracles can respond. FlareGuard solves this by combining **FTSO price feeds** with **FDC real-world event verification** into a single automated vault that returns your collateral the moment danger is detected.

**Built on Flare** | ETH Oxford 2026

- **Network:** Coston2 Testnet (Chain ID 114)
- **Flare Integrations:** FTSO v2 (price feeds), FDC JsonApi (off-chain event attestation)
- **Demo Link:** *[Coming soon]*

---

## Deployment Details

- **Contract Address:** [`0x31A22e4abbdBa1b6067567E90Bf27391931b60F4`](https://coston2-explorer.flare.network/address/0x31A22e4abbdBa1b6067567E90Bf27391931b60F4)
- **Block Explorer:** [Coston2 Explorer](https://coston2-explorer.flare.network/address/0x31A22e4abbdBa1b6067567E90Bf27391931b60F4)

---

## The Problem

Traditional DeFi liquidation protection is **reactive and one-dimensional** — it watches price and nothing else. But liquidation cascades are often triggered by events that happen *before* the price moves:

- A major exchange goes into **unscheduled maintenance**, trapping liquidity
- Market sentiment plunges into **extreme fear**, triggering panic sells
- **Bitcoin dominance surges**, draining capital from altcoin positions

By the time a price oracle reflects these events, it's already too late. Users wake up to empty positions and liquidation penalties.

## The Solution

FlareGuard is a **dual-trigger protection vault** that monitors both on-chain price data and real-world events simultaneously. Users deposit collateral, configure their safeguards, and the vault automatically returns funds the instant *any* danger condition is met.

**Key innovation:** FlareGuard is the first protocol to combine **FTSO** (decentralized price feeds) and **FDC** (off-chain event verification) in the same smart contract, enabling protection strategies that were previously impossible in DeFi.

### How It Works

```
User deposits collateral → Configures protection triggers → Monitors run automatically
                                                                    ↓
                                            Price trigger (FTSO) OR Event trigger (FDC)
                                                                    ↓
                                                    Funds returned to wallet safely
```

1. **Connect wallet** and deposit tokens into the FlareGuard vault on Coston2
2. **Configure safeguards** — choose from 4 independent protection triggers:
   - **FLR Price Drop** (FTSO) — trigger when price falls below your threshold
   - **Exchange Maintenance** (FDC) — trigger when Binance reports system downtime
   - **Fear & Greed Index** (FDC) — trigger when market sentiment hits extreme fear
   - **Bitcoin Dominance** (FDC) — trigger when BTC.D surges above your threshold
3. **Any single trigger** fires → vault automatically returns your collateral
4. **Monitor** active protections in real-time from the dashboard

---

## Flare Protocol Integration

### FTSO v2 — Decentralized Price Feeds

FlareGuard reads **live price data** from Flare's enshrined Time Series Oracle, with no external oracle dependencies.

| Feed | ID | Usage |
|------|----|-------|
| FLR/USD | `0x01464c522f555344...` | Primary price trigger |
| BTC/USD | `0x014254432f555344...` | Dashboard display |
| ETH/USD | `0x014554482f555344...` | Dashboard display |
| XRP/USD | `0x015852502f555344...` | Dashboard display |

**How it's used:**
- The smart contract calls `FtsoV2.getFeedById()` via `ContractRegistry.getTestFtsoV2()` to read current prices
- The frontend polls all 4 feeds every 30 seconds for real-time header display
- Users set a price threshold (e.g. "protect me if FLR < $0.02") and the contract compares live FTSO data against it during execution

### FDC JsonApi — Real-World Event Verification

FlareGuard uses Flare's Data Connector to bring **off-chain Web2 data on-chain** with cryptographic proof, verified by ~100 independent data providers.

| Trigger | API Source | Condition |
|---------|-----------|-----------|
| Exchange Status | `api.binance.com/sapi/v1/system/status` | Status = 1 (maintenance) |
| Fear & Greed Index | `api.alternative.me/fng/` | Index < threshold (e.g. 25) |
| Bitcoin Dominance | `api.coingecko.com/api/v3/global` | BTC.D > threshold (e.g. 60%) |

**How it's used:**
1. An FDC attestation request is submitted to `FdcHub.requestAttestation()` with the API URL and a JQ transform
2. ~100 data providers independently fetch and verify the API response in a voting round (~90 seconds)
3. The proof is accumulated on the DA Layer and fetched via `da-layer-testnet.flare.network`
4. The smart contract verifies the proof on-chain using `IJsonApiVerification.verifyJsonApi()` and decodes the response to check trigger conditions

**Smart contract verification logic:**
```solidity
// Verify FDC proof on-chain
IJsonApiVerification verifier = ContractRegistry.auxiliaryGetIJsonApiVerification();
require(verifier.verifyJsonApi(_proof), "Invalid FDC proof");

// Decode and check each trigger — if ANY fires, protection executes
uint256 apiValue = abi.decode(_proof.data.responseBody.abi_encoded_data, (uint256));
for (uint256 i = 0; i < rule.triggerTypes.length; i++) {
    if (triggerType == EXCHANGE_STATUS && apiValue == dangerValue) eventTriggered = true;
    if (triggerType == FEAR_GREED_INDEX && apiValue < dangerValue) eventTriggered = true;
    if (triggerType == BTC_DOMINANCE  && apiValue > dangerValue) eventTriggered = true;
}
```

### Why Enshrined Oracles Matter

Unlike protocols that depend on Chainlink or other external oracles, FlareGuard uses **Flare's enshrined data protocols** — meaning price feeds and data verification are built into the network itself. This gives us:

- **No external dependencies** — no third-party oracle risk
- **~100 independent validators** verifying every data point
- **On-chain proof verification** — not trust-based, cryptographically proven
- **Single contract** combining both FTSO + FDC — a pattern unique to Flare

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

## Current Implementation vs Production

### Hackathon Prototype (Current)

For the purposes of this hackathon, FlareGuard uses **simplified mock transactions**. When a protection trigger fires, the vault returns the deposited native tokens (C2FLR) directly to the user's wallet via a simple transfer. This allows us to demonstrate the full FTSO + FDC trigger pipeline — from real-time price monitoring and off-chain event attestation through to on-chain execution — without introducing the complexity of DEX routing.

```
Trigger fires → Vault returns deposited C2FLR to user's wallet
```

The core innovation — combining FTSO price feeds with FDC real-world event verification to detect danger conditions — is fully functional. What is simplified is the *response* to that detection.

### Production Implementation

In a production deployment, simply returning the same volatile asset defeats the purpose of protection — the asset continues to lose value after it's back in the user's wallet. A production FlareGuard would instead **swap the volatile collateral into a stablecoin** before returning it, locking in the user's value at the moment danger is detected.

```
Trigger fires
    ↓
Vault swaps collateral (e.g. FLR) → Stablecoin (e.g. USDC) via DEX
    ↓
Stablecoin transferred to user's wallet
    ↓
User's value is preserved in stable terms
```

**How the swap would work:**

1. **Trigger detection** — identical to the current system (FTSO price check + FDC event verification)
2. **DEX swap** — the vault calls a DEX router (e.g. a Flare-native AMM or Uniswap V3-style router) to swap the volatile asset for a stablecoin such as USDC or USDT, with a minimum output amount derived from the FTSO price feed to enforce slippage protection
3. **Stablecoin delivery** — the resulting stablecoins are transferred to the user's wallet
4. **Optional re-entry** — once market conditions stabilise, the user can swap back into their original position at the lower price, effectively buying the dip with protected capital

**Additional production considerations:**

- **Slippage protection** — use FTSO price data to calculate a minimum acceptable output, preventing sandwich attacks
- **MEV resistance** — route swaps through private mempools or use commit-reveal patterns to prevent front-running
- **Multi-asset vaults** — accept ERC-20 tokens (not just native FLR) and swap to the appropriate stablecoin pair
- **Automated keeper network** — replace the Vercel cron with a decentralised keeper network (e.g. Chainlink Automation or Gelato) for trustless, permissionless execution

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
│   │   ├── App.tsx                      # Main UI — 3-panel dashboard
│   │   ├── components/Header.tsx        # Navbar, live prices, help guide
│   │   ├── hooks/useWallet.ts           # MetaMask integration
│   │   ├── hooks/useContract.ts         # Contract interaction layer
│   │   ├── config/contract.ts           # Addresses, feed IDs, ABI
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

### Smart Contracts

```bash
cd contracts
npm install

# Compile
npx hardhat compile

# Deploy to Coston2 (requires PRIVATE_KEY in .env)
cp .env.example .env   # then add your private key
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

Update `frontend/src/config/contract.ts` with your deployed contract address if redeploying.

### FDC Attestation Flow

```bash
# 1. Submit FDC JsonApi request (e.g. Binance system status)
npx hardhat run scripts/submitFdcRequest.ts --network coston2

# 2. Wait ~3 minutes for the voting round to finalise

# 3. Fetch proof from the DA Layer and execute protection
VAULT_ADDRESS=0x... npx hardhat run scripts/fetchProofAndExecute.ts --network coston2 -- <roundId> <ruleId> <abiEncodedRequest>
```

### Environment Variables

Refer to `.env.example` files in both `contracts/` and `frontend/` directories:

| Variable | Location | Purpose |
|----------|----------|---------|
| `PRIVATE_KEY` | `contracts/.env` | Wallet key for deploying contracts via Hardhat |
| `VAULT_ADDRESS` | `contracts/.env` | Deployed FlareGuardVault address for FDC scripts |
| `KEEPER_PRIVATE_KEY` | `frontend/.env` | Wallet key for the Vercel keeper cron service |

---

## Our Experience Building on Flare

**Nic Erzetic** was incredibly helpful in giving us direction throughout the hackathon and in breaking down concepts related to FDC. His guidance made the difference between struggling with documentation alone and actually understanding *why* the attestation flow works the way it does — from request submission through voting rounds to on-chain proof verification.

The **workshops** were equally valuable in building a higher-level understanding of how FTSO and FDC fit together. Understanding the architecture before diving into code meant we could design our dual-trigger system with confidence rather than trial and error.

The **Flare developer site** provided excellent starter code that accelerated our development significantly. The [FDC Web2 JSON attestation guide](https://dev.flare.network/fdc/attestation-types/web2-json) was particularly useful — it gave us a working reference for structuring our JsonApi requests, including the JQ transforms we needed for parsing API responses like Binance system status and the Fear & Greed Index.

**What went well:**
- **FTSO integration was seamless.** Using `ContractRegistry.getTestFtsoV2()` and `getFeedById()`, we had live price feeds working in our contract within 30 minutes. The `@flarenetwork/flare-periphery-contracts` package made this straightforward.
- **Enshrined oracles are a genuine architectural advantage.** Not needing to deploy or manage external oracle infrastructure meant we could focus entirely on our protection logic.
- **Combining FTSO + FDC in a single contract** felt like a natural fit on Flare. The shared ContractRegistry pattern made it clean to access both protocols from the same contract.

**What could be improved:**
- More **cookbook-style examples** for common Web2 data patterns (REST API → JQ transform → attestation → on-chain verification) would help teams get started faster.
- A section in the docs about **multi-protocol patterns** (using FTSO + FDC together) would be valuable, since this is where Flare's real differentiation shines.
- The naming split between `IJsonApi` / `IWeb2Json` interfaces was initially confusing — consolidating or clarifying the relationship would help.

Overall, building on Flare was a positive experience. The enshrined oracle architecture removes an entire class of dependencies and trust assumptions that other chains require, and the tooling is mature enough for a hackathon team to build something production-grade in a weekend.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
