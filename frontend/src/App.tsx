import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, TrendingDown, Zap, Activity, LogOut, Info } from 'lucide-react';
import Header from './components/Header';
import { useWallet } from './hooks/useWallet';
import { useContract } from './hooks/useContract';
import { FEED_IDS, FDC_EVENT_PRESETS, VAULT_ADDRESS, COSTON2_RPC } from './config/contract';

interface Rule {
  id: number;
  owner: string;
  depositAmount: bigint;
  priceFeedId: string;
  priceTrigger: bigint;
  dangerValue: bigint;
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
  const [selectedFeed, setSelectedFeed] = useState('FLR/USD');
  const [selectedEvent, setSelectedEvent] = useState(0);
  
  // Multi-condition state
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>(['FLR/USD']);
  const [selectedEvents, setSelectedEvents] = useState<number[]>([0]);
  const [priceThresholds, setPriceThresholds] = useState<Record<string, string>>({
    'FLR/USD': '0.45',
  });
  const [useMultiCondition, setUseMultiCondition] = useState(false);

  // Data state
  const [userRules, setUserRules] = useState<Rule[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');

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

  // Fetch rules when wallet connects
  useEffect(() => {
    if (address && contract) fetchUserRules();
  }, [address, contract, fetchUserRules]);

  // Create protection rule
  const handleCreateRule = async () => {
    if (!contract || !depositAmount || !priceTrigger) return;
    setLoading(true);
    setTxStatus('Creating protection rule...');
    try {
      const feedId = FEED_IDS[selectedFeed];
      // Convert price trigger to FTSO-scaled value
      // FTSO returns prices with variable decimals, so we use the feed's decimal count
      const priceInfo = prices[selectedFeed];
      const decimals = priceInfo ? priceInfo.decimals : 7; // default fallback
      const scaledTrigger = Math.round(parseFloat(priceTrigger) * Math.pow(10, decimals));
      const dangerVal = FDC_EVENT_PRESETS[selectedEvent]?.dangerValue ?? 1;

      const tx = await contract.createRule(
        feedId,
        scaledTrigger,
        dangerVal,
        { value: ethers.parseEther(depositAmount) }
      );
      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus('Rule created successfully!');
      setDepositAmount('');
      fetchUserRules();
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setLoading(false);
    setTimeout(() => setTxStatus(''), 5000);
  };

  // Create multi-condition rule (ANY trigger protects entire collateral)
  const handleCreateMultiConditionRule = async () => {
    if (!contract || !depositAmount || selectedFeeds.length === 0) return;
    setLoading(true);
    setTxStatus('Creating multi-condition rule...');
    try {
      const feedIds: string[] = [];
      const triggers: bigint[] = [];

      for (const feed of selectedFeeds) {
        feedIds.push(FEED_IDS[feed]);
        const threshold = priceThresholds[feed];
        const priceInfo = prices[feed];
        const decimals = priceInfo ? priceInfo.decimals : 7;
        const scaledTrigger = Math.round(parseFloat(threshold) * Math.pow(10, decimals));
        triggers.push(BigInt(scaledTrigger));
      }

      const dangerValues = selectedEvents.map(idx => 
        BigInt(FDC_EVENT_PRESETS[idx]?.dangerValue ?? 1)
      );

      const tx = await contract.createMultiConditionRule(
        feedIds,
        triggers,
        dangerValues,
        { value: ethers.parseEther(depositAmount) }
      );

      setTxStatus('Waiting for confirmation...');
      await tx.wait();
      setTxStatus(`✅ Rule created! Protected on ANY of ${selectedFeeds.length + selectedEvents.length} triggers`);
      setDepositAmount('');
      fetchUserRules();
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
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setLoading(false);
    setTimeout(() => setTxStatus(''), 5000);
  };

  // Feed name from ID
  const feedNameFromId = (feedId: string) => {
    for (const [name, id] of Object.entries(FEED_IDS)) {
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
      <Header address={address} connect={connect} />

      <main className="container" style={{ marginTop: '60px', paddingBottom: '60px' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '16px', fontWeight: 800 }}>
            Never Get <span style={{ color: 'var(--primary)' }}>Liquidated</span> Again.
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '700px', margin: '0 auto' }}>
            FlareGuard monitors real-world events and on-chain prices to protect your assets before the crash happens.
          </p>
        </div>

        {/* Live Price Ticker */}
        {Object.keys(prices).length > 0 && (
          <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {Object.entries(prices).map(([name, info]) => (
              <div key={name} style={{ textAlign: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{name}</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>${info.value.toFixed(4)}</div>
              </div>
            ))}
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Source</span>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--success)' }}>FTSO v2</div>
            </div>
          </div>
        )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <ShieldCheck size={24} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Your Vault</h2>
              </div>
              <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={(e) => {
                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                if (tooltip) tooltip.style.opacity = '1';
              }} onMouseLeave={(e) => {
                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                if (tooltip) tooltip.style.opacity = '0';
              }}>
                <Info size={18} color="var(--text-muted)" style={{ cursor: 'help' }} />
                <div data-tooltip style={{ position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0, 0, 0, 0.95)', color: 'white', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap', zIndex: 99999, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.3s ease', border: '1px solid var(--primary)' }}>
                  Deposit collateral to create protection rules
                </div>
              </div>
            </div>

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
                  onClick={useMultiCondition ? handleCreateMultiConditionRule : handleCreateRule}
                  disabled={
                    loading ||
                    !isContractReady ||
                    !depositAmount ||
                    (useMultiCondition ? selectedFeeds.length === 0 : !priceTrigger)
                  }
                >
                  {loading ? 'Processing...' : useMultiCondition ? 'Create Multi-Condition Rule' : 'Deposit & Protect'}
                </button>
              </div>
              {useMultiCondition && selectedFeeds.length + selectedEvents.length > 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '8px', fontWeight: 'bold' }}>
                  ✅ Protecting entire deposit on ANY of {selectedFeeds.length + selectedEvents.length} triggers
                </p>
              )}
            </div>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Protected</span>
                <span style={{ fontWeight: 'bold' }}>
                  {totalProtected > 0n ? ethers.formatEther(totalProtected) : '0.00'} C2FLR
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Toggle between single and multi-condition */}
              <div style={{ padding: '12px', background: 'rgba(245, 69, 98, 0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={useMultiCondition}
                    onChange={(e) => setUseMultiCondition(e.target.checked)}
                  />
                  <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    Multi-condition Mode (protect on ANY trigger)
                  </span>
                </label>
              </div>

              {/* Single-condition form */}
              {!useMultiCondition ? (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>FTSO Price Feed</label>
                    <select value={selectedFeed} onChange={(e) => setSelectedFeed(e.target.value)}>
                      {Object.keys(FEED_IDS).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ color: 'var(--text-muted)' }}>Price Trigger Threshold</label>
                      {prices[selectedFeed] && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)', background: 'rgba(46, 204, 113, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                          Now: ${prices[selectedFeed].value.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <TrendingDown size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="number"
                        value={priceTrigger}
                        onChange={(e) => setPriceTrigger(e.target.value)}
                        style={{ paddingLeft: '40px' }}
                        step="0.01"
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>USD</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      If {selectedFeed.split('/')[0]} drops below this price, assets will be returned to your wallet.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>FDC Event Trigger (Advanced)</label>
                    <select value={selectedEvent} onChange={(e) => setSelectedEvent(Number(e.target.value))}>
                      <option value={0}>Binance System Maintenance (CEX)</option>
                    </select>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Verified by ~100 FDC data providers via JsonApi attestation
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Multi-select Price Feeds */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      Select Price Feed Triggers
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      {Object.keys(FEED_IDS).map(feed => (
                        <div key={feed} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedFeeds.includes(feed)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFeeds([...selectedFeeds, feed]);
                                  if (!priceThresholds[feed]) {
                                    setPriceThresholds({...priceThresholds, [feed]: '0.45'});
                                  }
                                } else {
                                  setSelectedFeeds(selectedFeeds.filter(f => f !== feed));
                                  const newThresholds = {...priceThresholds};
                                  delete newThresholds[feed];
                                  setPriceThresholds(newThresholds);
                                }
                              }}
                            />
                            <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{feed}</span>
                          </label>
                          {selectedFeeds.includes(feed) && (
                            <div>
                              <input
                                type="number"
                                placeholder="Threshold"
                                value={priceThresholds[feed] || ''}
                                onChange={(e) =>
                                  setPriceThresholds({...priceThresholds, [feed]: e.target.value})
                                }
                                style={{ width: '100%', padding: '6px', fontSize: '0.85rem' }}
                                step="0.01"
                              />
                              {prices[feed] && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                  Now: ${prices[feed].value.toFixed(4)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Multi-select Events */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      Select Event Triggers (Optional)
                    </label>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {FDC_EVENT_PRESETS.map((event, idx) => (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEvents([...selectedEvents, idx]);
                              } else {
                                setSelectedEvents(selectedEvents.filter(i => i !== idx));
                              }
                            }}
                          />
                          <span>{event.name || event.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
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
