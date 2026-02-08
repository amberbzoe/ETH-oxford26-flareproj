
import { useState } from 'react';
import { Wallet, Shield, HelpCircle, X } from 'lucide-react';

interface PriceInfo {
    value: number;
    decimals: number;
    timestamp: number;
}

interface HeaderProps {
    address: string | null;
    connect: () => void;
    prices: Record<string, PriceInfo>;
}

export default function Header({ address, connect, prices }: HeaderProps) {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <>
            <header className="glass-panel" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px' }}>
                    {/* Logo - Left */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', flex: '0 0 auto' }}>
                        <Shield size={32} />
                        <span>FlareGuard</span>
                    </div>

                    {/* Live Prices - Center */}
                    {Object.keys(prices).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: '1', justifyContent: 'center' }}>
                            {Object.entries(prices).map(([name, info]) => (
                                <div key={name} style={{ textAlign: 'center' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{name}</span>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>${info.value.toFixed(4)}</div>
                                </div>
                            ))}
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Source</span>
                                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--success)' }}>FTSO v2</div>
                            </div>
                        </div>
                    )}

                    {/* Right side - Help + Wallet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowHelp(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
                        >
                            <HelpCircle size={18} />
                            Help
                        </button>
                        <button className={address ? "btn-secondary" : "btn-primary"} onClick={connect} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Wallet size={18} />
                            {address ? address.slice(0, 6) + '...' + address.slice(-4) : "Connect Wallet"}
                        </button>
                    </div>
                </div>
            </header>

            {/* Help Modal */}
            {showHelp && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="glass-panel" style={{
                        maxWidth: '600px',
                        width: '90%',
                        padding: '32px',
                        position: 'relative',
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }}>
                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={24} />
                        </button>

                        <h2 style={{ marginBottom: '24px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <HelpCircle size={28} />
                            How to Use FlareGuard
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h3 style={{ marginBottom: '6px', color: 'var(--text-main)' }}>1. Connect Your Wallet</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    Click "Connect Wallet" in the top right corner. Ensure your wallet is set to the <strong>Coston2 testnet</strong> (Chain ID 114). You will need C2FLR tokens to make deposits.
                                </p>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '6px', color: 'var(--text-main)' }}>2. Configure Safeguards</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    Use the <strong>Asset Protection</strong> panel to enable one or more automated safeguards. Each can be toggled independently:
                                </p>
                                <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.8', paddingLeft: '20px', marginTop: '6px' }}>
                                    <li><strong>Binance Maintenance</strong> — activates if the exchange goes offline</li>
                                    <li><strong>FLR Price Drop</strong> — activates when FLR falls below your target price</li>
                                    <li><strong>Fear & Greed Index</strong> — activates when market sentiment drops below your threshold</li>
                                    <li><strong>Bitcoin Dominance</strong> — activates when BTC dominance rises above your threshold</li>
                                </ul>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '6px', color: 'var(--text-main)' }}>3. Deposit & Protect</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    In the <strong>Your Vault</strong> panel, enter the amount of C2FLR you wish to protect and click "Deposit & Protect". Your funds are held securely in the FlareGuard smart contract.
                                </p>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '6px', color: 'var(--text-main)' }}>4. Monitor & Manage</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                    The <strong>Active Protections</strong> panel displays all your current rules. If any safeguard condition is met, your funds are automatically returned to your wallet. You can also withdraw manually at any time.
                                </p>
                            </div>

                            <div style={{ marginTop: '4px', padding: '12px 16px', background: 'rgba(46, 204, 113, 0.08)', borderRadius: '10px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                                <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                                    <strong>How it works:</strong> FlareGuard uses Flare's FTSO for real-time price data and FDC for verified off-chain event data, both secured by approximately 100 independent data providers.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
