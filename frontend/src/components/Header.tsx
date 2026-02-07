import { Wallet, Shield } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
    const [address, setAddress] = useState<string | null>(null);

    const connect = () => {
        // Mock connection for UI
        setAddress("0x71C...9A23");
    };

    return (
        <header className="glass-panel" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    <Shield size={32} />
                    <span>FlareGuard</span>
                </div>

                <nav style={{ display: 'flex', gap: '32px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    <a href="#" style={{ color: 'var(--text-main)', textDecoration: 'none' }}>Dashboard</a>
                    <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Vault</a>
                    <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>History</a>
                </nav>

                <button className={address ? "btn-secondary" : "btn-primary"} onClick={connect} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={18} />
                    {address ? address : "Connect Wallet"}
                </button>
            </div>
        </header>
    );
}
