
import { Wallet, Shield } from 'lucide-react';

interface PriceInfo {
  value: number;
  decimals: number;
  timestamp: number;
}

interface HeaderProps {
    address: string | null;
    connect: () => void;
    prices?: Record<string, PriceInfo>;
}

export default function Header({ address, connect, prices }: HeaderProps) {
    return (
        <header className="glass-panel" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0, position: 'sticky', top: 0, zIndex: 100 }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 'auto', padding: '12px 0', flexWrap: 'wrap', gap: '20px' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    <Shield size={32} />
                    <span>FlareGuard</span>
                </div>

                {/* Live Prices */}
                {prices && Object.keys(prices).length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
                    {Object.entries(prices).map(([name, info]) => (
                      <div key={name} style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{name}</span>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>${info.value.toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Connect Button */}
                <button className={address ? "btn-secondary" : "btn-primary"} onClick={connect} style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <Wallet size={18} />
                    {address ? address.slice(0, 6) + '...' + address.slice(-4) : "Connect Wallet"}
                </button>
            </div>
        </header>
    );
}
