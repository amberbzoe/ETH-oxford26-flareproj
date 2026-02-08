
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>1. Connect Your Wallet</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    Click "Connect Wallet" and switch to the Coston2 testnet. You'll need some C2FLR tokens for deposits.
                                </p>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>2. Set Your Triggers</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    <strong>Price Trigger:</strong> Choose an asset (FLR, XRP, BTC, ETH) and set a price threshold. If the price drops below this, protection activates.<br /><br />
                                    <strong>FDC Event Trigger:</strong> Choose from events like exchange maintenance, Fear & Greed Index, or Bitcoin Dominance for additional protection.
                                </p>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>3. Deposit & Protect</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    Enter the amount of C2FLR to protect and click "Deposit & Protect". Your funds are secured in the FlareGuard vault.
                                </p>
                            </div>

                            <div>
                                <h3 style={{ marginBottom: '8px', color: 'var(--text)' }}>4. Automatic Protection</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    When any trigger condition is met, your assets are automatically returned to your wallet, protecting you from further losses.
                                </p>
                            </div>

                            <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                                <p style={{ color: 'var(--success)', fontSize: '0.85rem', margin: 0 }}>
                                    💡 <strong>Tip:</strong> You can withdraw your funds anytime before a trigger by clicking "Withdraw" on your active protection rules.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
