import { ShieldCheck, TrendingDown, Zap } from 'lucide-react';
import Header from './components/Header';
import { useWallet } from './hooks/useWallet';

export default function App() {
  const { address, balance, connect } = useWallet();

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Vault Section */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(245, 69, 98, 0.1)', padding: '10px', borderRadius: '12px' }}>
                <ShieldCheck size={24} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Your Vault</h2>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ color: 'var(--text-muted)' }}>Deposit Collateral (FXRP)</label>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Balance: {parseFloat(balance).toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="number" placeholder="0.00" style={{ flex: 1 }} />
                <button className="btn-primary">Deposit</button>
              </div>
            </div>

            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Protected</span>
                <span style={{ fontWeight: 'bold' }}>0.00 FXRP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Health Factor</span>
                <span style={{ color: 'var(--success)' }}>Safe</span>
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
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ color: 'var(--text-muted)' }}>FTSO Price Trigger</label>
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', background: 'rgba(46, 204, 113, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>Active</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <TrendingDown size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="number" defaultValue={0.45} style={{ paddingLeft: '40px' }} />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>USD</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  If XRP drops below this price, assets will be swapped to USDC.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>FDC Event Trigger (Advanced)</label>
                <select>
                  <option>Select an event source...</option>
                  <option>SEC Enforcement Action (Regulatory)</option>
                  <option>USDT Depeg &gt; 5% (Market)</option>
                  <option>Binance Withdrawal Halt (CEX)</option>
                </select>
              </div>

              <button className="btn-secondary" style={{ width: '100%', marginTop: '8px' }}>Update Triggers</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

