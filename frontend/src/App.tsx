import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, Zap, Activity, LogOut } from 'lucide-react';
import Header from './components/Header';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import { FEED_IDS, VAULT_ADDRESS, COSTON2_RPC } from './config/contract';

interface Rule {
  id: number;
  owner: string;
  depositAmount: bigint;
  priceFeedId: string;
  priceTrigger: bigint;
  dangerValue: bigint;
  triggerType: number;
  isActive: boolean;
}

interface PriceInfo {
  value: number;
  decimals: number;
  timestamp: number;
}

export default function App() {
  const { address, signer, isCoston2, connect } = useWallet();
  const contract = useContract(signer);

  // Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [priceTrigger, setPriceTrigger] = useState('0.45');

  // Trigger enable states (checkboxes)
  const [enablePriceTrigger, setEnablePriceTrigger] = useState(true);
  const [enableBinanceMaintenance, setEnableBinanceMaintenance] = useState(false);
  const [enableFearGreed, setEnableFearGreed] = useState(false);
  const [enableBtcDominance, setEnableBtcDominance] = useState(false);

  const [fearGreedThreshold, setFearGreedThreshold] = useState('25');
  const [btcDominanceThreshold, setBtcDominanceThreshold] = useState('60');

  // Data state
  const [userRules, setUserRules] = useState<Rule[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [walletBalance, setWalletBalance] = useState<string>('0');

  // Fetch live FTSO prices via read-only provider
  const fetchPrices = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(COSTON2_RPC);
      const registryContract = new ethers.Contract(
        "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
        ["function getContractAddressByName(string) view returns (address)"],
        provider
      );
      const ftsoAddr = await registryContract.getContractAddressByName("FtsoV2");
      const ftso = new ethers.Contract(
        ftsoAddr,
        ["function getFeedById(bytes21) view returns (uint256, int8, uint64)"],
        provider
      );

      const newPrices: Record<string, PriceInfo> = {};
      for (const [name, feedId] of Object.entries(FEED_IDS)) {
        try {
          const [value, decimals, timestamp] = await ftso.getFeedById(feedId);
          newPrices[name] = {
            value: Number(value) / Math.pow(10, Number(decimals)),
            decimals: Number(decimals),
            timestamp: Number(timestamp),
          };
        } catch {
          // Feed not available
        }
      }
      setPrices(newPrices);
    } catch (e) {
      console.error("Failed to fetch prices:", e);
    }
  }, []);

  // Fetch user's rules from contract
  const fetchUserRules = useCallback(async () => {
    if (!contract || !address) return;
    try {
      const ruleIds: bigint[] = await contract.getUserRules(address);
      const fetched: Rule[] = [];
      for (const id of ruleIds) {
        const r = await contract.rules(id);
        fetched.push({
          id: Number(id),
          owner: r.owner,
          depositAmount: r.depositAmount,
          priceFeedId: r.priceFeedId,
          priceTrigger: r.priceTrigger,
          dangerValue: r.dangerValue,
          triggerType: Number(r.triggerType),
          isActive: r.isActive,
        });
      }
      setUserRules(fetched);
    } catch (e) {
      console.error("Failed to fetch rules:", e);
    }
  }, [contract, address]);

  // Poll prices every 30s
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
    if (!signer || !address) {
      setWalletBalance('0');
      return;
    }
    try {
      const provider = signer.provider;
      if (provider) {
        const balance = await provider.getBalance(address);
        setWalletBalance(ethers.formatEther(balance));
      }
    } catch (e) {
      console.error("Failed to fetch wallet balance:", e);
      setWalletBalance('0');
    }
  }, [signer, address]);

  // Fetch rules when wallet connects
  useEffect(() => {
    if (address && contract) fetchUserRules();
  }, [address, contract, fetchUserRules]);

  // Fetch wallet balance when wallet connects
  useEffect(() => {
    if (address && signer) {
      fetchWalletBalance();
      // Refresh balance every 10 seconds
      const interval = setInterval(fetchWalletBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [address, signer, fetchWalletBalance]);

  // Create protection rule
  const handleCreateRule = async () => {
    if (!contract || !depositAmount || !priceTrigger) return;
    setLoading(true);
    setTxStatus('Creating protection rule...');
    try {
      // Hardcoded FLR/USD feed ID (category 1, 'FLR', 'USD')
      const feedId = '0x01464c522f55534400000000000000000000000000';
      // Convert price trigger to FTSO-scaled value (using 7 decimals for FLR)
      const priceInfo = prices['FLR/USD'];
      const decimals = priceInfo ? priceInfo.decimals : 7; // default fallback
      const scaledTrigger = Math.round(parseFloat(priceTrigger) * Math.pow(10, decimals));
      // Determine which FDC trigger to use (priority: Binance > Fear&Greed > BTC Dominance)
      let dangerVal: number = 1;
      let triggerType: number = 0;

      if (enableBinanceMaintenance) {
        triggerType = 0;  // EXCHANGE_STATUS
        dangerVal = 1;    // Maintenance mode
      } else if (enableFearGreed) {
        triggerType = 1;  // FEAR_GREED_INDEX
        dangerVal = parseInt(fearGreedThreshold);
      } else if (enableBtcDominance) {
        triggerType = 2;  // BTC_DOMINANCE
        dangerVal = parseInt(btcDominanceThreshold);
      }

      const tx = await contract.createRule(
        feedId,
        scaledTrigger,
        dangerVal,
        triggerType,
        { value: ethers.parseEther(depositAmount) }
      );
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Rule created successfully!');
      setDepositAmount('');
      fetchUserRules();
      fetchWalletBalance(); // Refresh wallet balance after deposit
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setLoading(false);
    setTimeout(() => setTxStatus(''), 5000);
  };

  // Withdraw from a rule
  const handleWithdraw = async (ruleId: number) => {
    if (!contract) return;
    setLoading(true);
    setTxStatus('Withdrawing...');
    try {
      const tx = await contract.withdraw(ruleId);
      await tx.wait();
      setTxStatus('Withdrawn successfully!');
      fetchUserRules();
      fetchWalletBalance(); // Refresh wallet balance after withdrawal
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setLoading(false);
    setTimeout(() => setTxStatus(''), 5000);
  };

  // Feed name from ID
  const feedNameFromId = (feedId: string) => {
    for (const [name, id] of Object.entries(FEED_IDS) as [string, string][]) {
      if (id.toLowerCase() === feedId.toLowerCase()) return name;
    }
    return feedId.slice(0, 10) + '...';
  };

  // Total protected amount
  const totalProtected = userRules
    .filter(r => r.isActive)
    .reduce((sum, r) => sum + r.depositAmount, 0n);

  const isContractReady = contract !== null && isCoston2;

  return (
    <div style={{ minHeight: '100vh', backgroundImage: 'radial-gradient(circle at 50% 0%, #1a2332 0%, #0A0E17 100%)' }}>
      <Header address={address} connect={connect} prices={prices} />

      <main className="container" style={{ marginTop: '60px', paddingBottom: '60px' }}>




        {/* Status Banner */}
        {txStatus && (
          <div className="glass-panel" style={{ padding: '12px 24px', marginBottom: '24px', textAlign: 'center', color: txStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
            {txStatus}
          </div>
        )}

        {!address && (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Connect your wallet to get started</p>
            <button className="btn-primary" onClick={connect}>Connect Wallet</button>
          </div>
        )}

        {address && !isCoston2 && (
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px', color: 'var(--warning)' }}>
            Please switch to Coston2 testnet (Chain ID 114)
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Vault Section */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '10px', borderRadius: '12px' }}>
                <ShieldCheck size={24} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Your Vault</h2>
            </div>

            {/* Protected Assets Display */}
            {address && (
              <div style={{
                marginBottom: '24px',
                padding: '16px',
                background: 'rgba(46, 204, 113, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(46, 204, 113, 0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Protected Assets</span>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    color: 'var(--success)'
                  }}>
                    {totalProtected > 0n ? ethers.formatEther(totalProtected) : '0.00'} C2FLR
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Deposit Collateral (C2FLR)</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="number"
                  placeholder="0.00"
                  style={{ flex: 1 }}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <button
                  className="btn-primary"
                  onClick={handleCreateRule}
                  disabled={loading || !isContractReady || !depositAmount}
                >
                  {loading ? 'Processing...' : 'Deposit & Protect'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Wallet Balance</span>
                <span style={{ fontWeight: 'bold' }}>
                  {parseFloat(walletBalance).toFixed(4)} C2FLR
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Rules</span>
                <span style={{ fontWeight: 'bold' }}>{userRules.filter(r => r.isActive).length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network</span>
                <span style={{ color: isCoston2 ? 'var(--success)' : 'var(--warning)' }}>
                  {isCoston2 ? 'Coston2' : 'Wrong Network'}
                </span>
              </div>
            </div>
          </div>

          {/* Rules Section */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(241, 196, 15, 0.1)', padding: '10px', borderRadius: '12px' }}>
                <Zap size={24} color="var(--warning)" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Protection Triggers</h2>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select triggers that will protect your assets. When ANY trigger activates, funds return to your wallet.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Binance Maintenance - no threshold needed */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: enableBinanceMaintenance ? 'rgba(241, 196, 15, 0.1)' : 'rgba(255,255,255,0.03)',
                border: enableBinanceMaintenance ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={enableBinanceMaintenance}
                    onChange={(e) => setEnableBinanceMaintenance(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--warning)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Binance Maintenance</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sell when Binance goes into maintenance</div>
                  </div>
                </label>
              </div>

              {/* FLR Price Drop - with threshold input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: enablePriceTrigger ? 'rgba(245, 69, 98, 0.1)' : 'rgba(255,255,255,0.03)',
                border: enablePriceTrigger ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={enablePriceTrigger}
                    onChange={(e) => setEnablePriceTrigger(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>FLR Price Drop</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sell when FLR falls below price</div>
                  </div>
                </label>
                {enablePriceTrigger && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>$</span>
                    <input
                      type="number"
                      value={priceTrigger}
                      onChange={(e) => setPriceTrigger(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '80px', padding: '6px 10px', fontSize: '0.9rem' }}
                      step="0.01"
                    />
                  </div>
                )}
              </div>

              {/* Fear & Greed Index - with threshold input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: enableFearGreed ? 'rgba(231, 76, 60, 0.1)' : 'rgba(255,255,255,0.03)',
                border: enableFearGreed ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={enableFearGreed}
                    onChange={(e) => setEnableFearGreed(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--danger)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Fear & Greed Index</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sell when index drops below value</div>
                  </div>
                </label>
                {enableFearGreed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>&lt;</span>
                    <input
                      type="number"
                      value={fearGreedThreshold}
                      onChange={(e) => setFearGreedThreshold(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '60px', padding: '6px 10px', fontSize: '0.9rem' }}
                      min="0"
                      max="100"
                    />
                  </div>
                )}
              </div>

              {/* BTC Dominance - with threshold input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: enableBtcDominance ? 'rgba(155, 89, 182, 0.1)' : 'rgba(255,255,255,0.03)',
                border: enableBtcDominance ? '1px solid #9b59b6' : '1px solid var(--border-color)',
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={enableBtcDominance}
                    onChange={(e) => setEnableBtcDominance(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#9b59b6' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Bitcoin Dominance</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sell when BTC.D rises above %</div>
                  </div>
                </label>
                {enableBtcDominance && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>&gt;</span>
                    <input
                      type="number"
                      value={btcDominanceThreshold}
                      onChange={(e) => setBtcDominanceThreshold(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '60px', padding: '6px 10px', fontSize: '0.9rem' }}
                      min="40"
                      max="80"
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>%</span>
                  </div>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              Powered by Flare FTSO & FDC — verified by ~100 data providers
            </p>
          </div>
        </div>

        {/* Active Protections Dashboard */}
        {userRules.length > 0 && (
          <div className="glass-panel" style={{ padding: '32px', marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '10px', borderRadius: '12px' }}>
                <Activity size={24} color="var(--success)" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Active Protections</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {userRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      Rule #{rule.id} — {feedNameFromId(rule.priceFeedId)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Deposit: {ethers.formatEther(rule.depositAmount)} C2FLR |
                      Trigger: ${(Number(rule.priceTrigger) / Math.pow(10, prices[feedNameFromId(rule.priceFeedId)]?.decimals || 7)).toFixed(4)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: rule.isActive ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                      color: rule.isActive ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {rule.isActive ? 'Active' : 'Triggered'}
                    </span>
                    {rule.isActive && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleWithdraw(rule.id)}
                        disabled={loading}
                      >
                        <LogOut size={14} /> Withdraw
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contract Info Footer */}
        {isContractReady && (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Contract: {VAULT_ADDRESS.slice(0, 6)}...{VAULT_ADDRESS.slice(-4)} on Coston2
          </div>
        )}
      </main>
    </div>
  );
}
