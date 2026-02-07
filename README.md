# FlareGuard 🛡️

**Protect your crypto assets from market crashes and real-world events.**

FlareGuard is a DeFi safety protocol built on the **Flare Network**. It allows users to deposit assets (FXRP) and set sophisticated protection rules that trigger automatic exits to stablecoins.

Utilizing Flare's enshrined data protocols:
1.  **FTSO (Flare Time Series Oracle)**: Triggers liquidation protection if asset price drops below a threshold.
2.  **FDC (Flare Data Connector)**: Triggers protection based on real-world events (e.g., regulatory actions, CEX halts, stablecoin depegs).

## 🚀 Key Features

*   **Smart Vaults**: Deposit FXRP and sleep soundly.
*   **Dual-Trigger System**:
    *   **Price Trigger**: "If XRP < $0.45, swap to USDC."
    *   **Event Trigger**: "If SEC sues Exchange X, swap to USDC."
*   **Automated Execution**: Keepers monitor conditions and execute swaps instantly on-chain.

## 🛠️ Tech Stack

*   **Blockchain**: Flare Network (Coston2 Testnet)
*   **Smart Contracts**: Solidity, Hardhat
*   **Frontend**: Vite, React, TypeScript, Vanilla CSS (Glassmorphism UI)
*   **Integration**: Ethers.js, Wagmi

## 📦 Installation & Setup

### Prerequisites
*   Node.js v18+
*   Git

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/FlareGuard.git
cd FlareGuard
```

### 2. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
# Deploy to Coston2
# npx hardhat run scripts/deploy.ts --network coston2
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🏆 Hackathon Tracks

**Main Track**: "Use protocols on Flare blockchain in an innovative and world changing way!"
*   We use **FTSO** for reliable price feeds.
*   We use **FDC** to bring off-chain "risk events" on-chain to trigger protective actions.

## 📝 Developer Feedback (Flare Integration)

Building on Flare has been an interesting experience, particularly bridging Web2 data via FDC. The FTSO integration was straightforward thanks to the robust documentation. We found the following:
*   **Pros**: Fast finality, low fees, and the FDC opens up massive possibilities for "Event-Driven DeFi".
*   **Cons**: [User to add specific feedback]

## 📜 License
MIT