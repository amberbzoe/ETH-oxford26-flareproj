import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, Zap, Activity, LogOut, Wrench, TrendingDown, Gauge, BarChart3 } from 'lucide-react';
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

      // Build arrays of trigger types and danger values based on enabled checkboxes
      const triggerTypes: number[] = [];
      const dangerValues: number[] = [];

      if (enableBinanceMaintenance) {
        triggerTypes.push(0);  // EXCHANGE_STATUS
        dangerValues.push(1);  // Maintenance mode
      }
      if (enableFearGreed) {
        triggerTypes.push(1);  // FEAR_GREED_INDEX
        dangerValues.push(parseInt(fearGreedThreshold) || 25);
      }
      if (enableBtcDominance) {
        triggerTypes.push(2);  // BTC_DOMINANCE
        dangerValues.push(parseInt(btcDominanceThreshold) || 60);
      }

      const tx = await contract.createRule(
        feedId,
        scaledTrigger,
        triggerTypes,
        dangerValues,
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

  // Execute protection (test trigger) - calls contract to check if conditions are met
  const handleExecuteProtection = async (ruleId: number) => {
    if (!contract) return;
    setLoading(true);
    setTxStatus('Checking trigger conditions...');
    try {
      // Empty FDC proof - only price trigger will be checked
      const emptyProof = {
        merkleProof: [],
        data: {
          attestationType: '0x0000000000000000000000000000000000000000000000000000000000000000',
          sourceId: '0x0000000000000000000000000000000000000000000000000000000000000000',
          votingRound: 0,
          lowestUsedTimestamp: 0,
          requestBody: { url: '', postprocessJq: '', abi_signature: '' },
          responseBody: { abi_encoded_data: '0x' }
        }
      };
      const tx = await contract.executeProtection(ruleId, emptyProof);
      await tx.wait();
      setTxStatus('Protection triggered! Funds returned to wallet.');
      fetchUserRules();
      fetchWalletBalance();
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

      <main className="container" style={{ marginTop: '20px', paddingBottom: '24px' }}>
        {/* Status Banner */}
        {txStatus && (
          <div className="glass-panel" style={{ padding: '12px 24px', marginBottom: '24px', textAlign: 'center', color: txStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
            {txStatus}
          </div>
        )}

        {address && !isCoston2 && (
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px', color: 'var(--primary)' }}>
            Please switch to Coston2 testnet (Chain ID 114)
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '5fr 4fr 4fr', gap: '16px', alignItems: 'stretch' }}>
          {/* Rules Section */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '8px', borderRadius: '10px' }}>
                <Zap size={20} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.2rem' }}>Asset Protection</h2>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Configure automated safeguards for your deposits. When any condition is met, funds are returned immediately.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Binance Maintenance */}
              <div
                className={`trigger-row${enableBinanceMaintenance ? ' active' : ''}`}
                style={{ '--trigger-bg': 'rgba(46, 204, 113, 0.06)', '--trigger-accent': 'var(--success)' } as React.CSSProperties}
                onClick={() => setEnableBinanceMaintenance(!enableBinanceMaintenance)}
              >
                <div className="trigger-icon" style={{ background: enableBinanceMaintenance ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                  <Wrench size={16} color={enableBinanceMaintenance ? 'var(--success)' : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>Binance Maintenance</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Triggers when exchange goes offline</div>
                </div>
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={enableBinanceMaintenance} onChange={(e) => setEnableBinanceMaintenance(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* FLR Price Drop */}
              <div
                className={`trigger-row${enablePriceTrigger ? ' active' : ''}`}
                style={{ '--trigger-bg': 'rgba(46, 204, 113, 0.06)', '--trigger-accent': 'var(--success)' } as React.CSSProperties}
                onClick={() => setEnablePriceTrigger(!enablePriceTrigger)}
              >
                <div className="trigger-icon" style={{ background: enablePriceTrigger ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                  <TrendingDown size={16} color={enablePriceTrigger ? 'var(--success)' : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>FLR Price Drop</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Triggers when FLR falls below target</div>
                </div>
                {enablePriceTrigger && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>$</span>
                    <input
                      type="number"
                      value={priceTrigger}
                      onChange={(e) => setPriceTrigger(e.target.value)}
                      style={{ width: '70px', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                      step="0.01"
                    />
                  </div>
                )}
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={enablePriceTrigger} onChange={(e) => setEnablePriceTrigger(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* Fear & Greed Index */}
              <div
                className={`trigger-row${enableFearGreed ? ' active' : ''}`}
                style={{ '--trigger-bg': 'rgba(46, 204, 113, 0.06)', '--trigger-accent': 'var(--success)' } as React.CSSProperties}
                onClick={() => setEnableFearGreed(!enableFearGreed)}
              >
                <div className="trigger-icon" style={{ background: enableFearGreed ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                  <Gauge size={16} color={enableFearGreed ? 'var(--success)' : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>Fear & Greed Index</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Triggers when sentiment drops below</div>
                </div>
                {enableFearGreed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>&lt;</span>
                    <input
                      type="number"
                      value={fearGreedThreshold}
                      onChange={(e) => setFearGreedThreshold(e.target.value)}
                      style={{ width: '56px', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                      min="0"
                      max="100"
                    />
                  </div>
                )}
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={enableFearGreed} onChange={(e) => setEnableFearGreed(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* BTC Dominance */}
              <div
                className={`trigger-row${enableBtcDominance ? ' active' : ''}`}
                style={{ '--trigger-bg': 'rgba(46, 204, 113, 0.06)', '--trigger-accent': 'var(--success)' } as React.CSSProperties}
                onClick={() => setEnableBtcDominance(!enableBtcDominance)}
              >
                <div className="trigger-icon" style={{ background: enableBtcDominance ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)' }}>
                  <BarChart3 size={16} color={enableBtcDominance ? 'var(--success)' : 'var(--text-muted)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3 }}>Bitcoin Dominance</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>Triggers when BTC.D rises above</div>
                </div>
                {enableBtcDominance && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>&gt;</span>
                    <input
                      type="number"
                      value={btcDominanceThreshold}
                      onChange={(e) => setBtcDominanceThreshold(e.target.value)}
                      style={{ width: '56px', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                      min="0"
                      max="100"
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>%</span>
                  </div>
                )}
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={enableBtcDominance} onChange={(e) => setEnableBtcDominance(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>
              Powered by Flare FTSO & FDC — verified by ~100 data providers
            </p>
          </div>

          {/* Vault Section */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '8px', borderRadius: '10px' }}>
                <ShieldCheck size={20} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.2rem' }}>Your Vault</h2>
            </div>

            {/* Protected Assets Display */}
            {address && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Deposit Collateral (C2FLR)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="0.00"
                  style={{ flex: 1 }}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <button
                  className="btn-primary"
                  onClick={handleCreateRule}
                  disabled={loading || !isContractReady || !depositAmount || parseFloat(depositAmount) <= 0}
                >
                  {loading ? 'Processing...' : 'Deposit & Protect'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
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
                <span style={{ color: isCoston2 ? 'var(--success)' : 'var(--primary)' }}>
                  {isCoston2 ? 'Coston2' : 'Wrong Network'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Protections Dashboard */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '8px', borderRadius: '10px' }}>
                <Activity size={20} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.2rem' }}>Active Protections</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', height: '400px', paddingRight: '4px' }}>
              {!address ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Connect your wallet to view and manage your protection rules.
                </div>
              ) : userRules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No active protections yet. Deposit funds to create your first rule.
                </div>
              ) : userRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Rule #{rule.id} — {feedNameFromId(rule.priceFeedId)}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: rule.isActive ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                      color: rule.isActive ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {rule.isActive ? 'Active' : 'Triggered'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: rule.isActive ? '8px' : '0' }}>
                    {ethers.formatEther(rule.depositAmount)} C2FLR — Trigger: ${(Number(rule.priceTrigger) / Math.pow(10, prices[feedNameFromId(rule.priceFeedId)]?.decimals || 7)).toFixed(4)}
                  </div>
                  {rule.isActive && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(46, 204, 113, 0.15)', border: '1px solid var(--success)', flex: 1 }}
                        onClick={() => handleExecuteProtection(rule.id)}
                        disabled={loading}
                      >
                        Test Trigger
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1 }}
                        onClick={() => handleWithdraw(rule.id)}
                        disabled={loading}
                      >
                        <LogOut size={12} /> Withdraw
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contract Info Footer */}
        {isContractReady && (
          <div style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Contract: {VAULT_ADDRESS.slice(0, 6)}...{VAULT_ADDRESS.slice(-4)} on Coston2
          </div>
        )}
      </main>
    </div>
  );
}
