// Group F — Account settings & Billing

const AccountSettingsScreen = () => (
  <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
    <TopNav active="Account"/>
    <div style={{ padding: '48px 64px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 48 }}>
        <div>
          <div className="t-overline" style={{ marginBottom: 16 }}>Account</div>
          {['Profile','Connected services','Billing','Notifications','Security'].map((t, i) => (
            <div key={t} style={{ padding: '8px 10px', marginBottom: 2, borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: i === 0 ? 'var(--surface-2)' : 'transparent',
              color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>{t}</div>
          ))}
        </div>
        <div>
          <div className="t-display" style={{ marginBottom: 32 }}>Profile</div>

          <SettingGroup label="You">
            <SettingRow label="Avatar">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--f-display)' }}>C</div>
                <Button variant="secondary" size="sm">Upload</Button>
                <Button variant="ghost" size="sm">Remove</Button>
              </div>
            </SettingRow>
            <SettingRow label="Name"><Input value="Clara Jensen" style={{ maxWidth: 300 }}/></SettingRow>
            <SettingRow label="Email"><Input value="clara@craftletters.co" style={{ maxWidth: 300 }}/></SettingRow>
            <SettingRow label="Handle"><span className="t-mono">appio.app/clara</span></SettingRow>
          </SettingGroup>

          <SettingGroup label="Connected services">
            <ServiceRow icon="convex" name="Convex" acct="clara@craftletters.co" status="connected"/>
            <ServiceRow icon="github" name="GitHub" acct="github.com/claraj" status="connected"/>
            <ServiceRow icon="google" name="Google" acct="Sign-in provider" status="connected"/>
          </SettingGroup>

          <SettingGroup label="Preferences">
            <SettingRow label="Theme">
              <ThemeToggleWidget/>
            </SettingRow>
            <SettingRow label="Keyboard"><span style={{ fontSize: 13 }}>Command palette · <span className="t-mono">⌘K</span></span></SettingRow>
          </SettingGroup>
        </div>
      </div>
    </div>
  </div>
);

const ServiceRow = ({ icon, name, acct, status }) => (
  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--hair)' }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={18}/>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
      <div className="t-caption" style={{ marginTop: 2 }}>{acct}</div>
    </div>
    <Chip variant="ready">Connected</Chip>
    <Button variant="ghost" size="sm">Manage</Button>
  </div>
);

// Theme toggle that reflects and controls the global mode
const ThemeToggleWidget = () => {
  const [mode, setMode] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  React.useEffect(() => {
    // Observe doc-level data-theme changes
    const obs = new MutationObserver(() => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      setMode(cur);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const select = (m) => {
    document.documentElement.setAttribute('data-theme', m);
    setMode(m);
    // Also notify parent edit-mode state
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { mode: m } }, '*');
  };

  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 2, borderRadius: 6, width: 'fit-content' }}>
      {[['dark', '☾  Dark'], ['light', '☀  Light'], ['system', 'System']].map(([key, label]) => {
        const active = mode === key || (key === 'dark' && !mode);
        return (
          <div key={key} onClick={() => select(key === 'system' ? 'dark' : key)} style={{
            padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
            background: active ? 'var(--surface-0)' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: active ? 500 : 400,
          }}>{label}</div>
        );
      })}
    </div>
  );
};

// ---------- Billing ----------
const BillingScreen = () => (
  <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
    <TopNav active="Account"/>
    <div style={{ padding: '48px 64px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="t-overline" style={{ marginBottom: 8 }}>Billing</div>
      <div className="t-display" style={{ marginBottom: 32 }}>You're on Creator.</div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 12, padding: 32, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <div className="t-h3">Generations this month</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
            <span className="t-display" style={{ fontSize: 48, letterSpacing: '-0.03em' }}>218</span>
            <span className="t-body-lg muted">/ 500</span>
          </div>
          <div style={{ height: 8, background: 'var(--hair)', borderRadius: 4, marginTop: 16, overflow: 'hidden' }}>
            <div style={{ width: '43.6%', height: '100%', background: 'var(--accent)' }}/>
          </div>
          <div className="t-caption" style={{ marginTop: 10 }}>Resets May 1 · About 10 days</div>
        </div>
        <div style={{ borderLeft: '1px solid var(--hair)', paddingLeft: 32 }}>
          <div className="t-caption" style={{ marginBottom: 6 }}>Next invoice</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>$19.00</div>
          <div className="t-caption" style={{ marginTop: 4 }}>On May 8 · Visa ending 4242</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button variant="secondary" size="sm">Change card</Button>
            <Button variant="ghost" size="sm">View invoices</Button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <PlanCard tier="Free" price="$0" freq="forever" features={['3 apps','50 generations/mo','Appio subdomain','Community support']} cta="Downgrade"/>
        <PlanCard tier="Creator" price="$19" freq="per month" features={['Unlimited apps','500 generations/mo','Custom domain','Email support','Priority queue']} cta="Current plan" active/>
        <PlanCard tier="Pro" price="$49" freq="per month" features={['Everything in Creator','2,000 generations/mo','Team seats','SSO & audit log','Dedicated support']} cta="Upgrade" primary/>
      </div>
    </div>
  </div>
);

const PlanCard = ({ tier, price, freq, features, cta, active, primary }) => (
  <div style={{
    background: active ? 'var(--accent-soft)' : 'var(--surface-1)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--hair)'}`,
    borderRadius: 12, padding: 24,
    position: 'relative',
  }}>
    {active && <Chip variant="published" style={{ position: 'absolute', top: 16, right: 16 }}>Current</Chip>}
    <div className="t-overline" style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 8 }}>{tier}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
      <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>{price}</span>
      <span className="t-caption">{freq}</span>
    </div>
    {features.map(f => (
      <div key={f} style={{ padding: '6px 0', display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <Icon name="check" size={14} stroke="var(--accent)"/>
        <span>{f}</span>
      </div>
    ))}
    <div style={{ marginTop: 24 }}>
      <Button variant={primary ? 'primary' : active ? 'secondary' : 'ghost'} full disabled={active}>{cta}</Button>
    </div>
  </div>
);

Object.assign(window, { AccountSettingsScreen, BillingScreen });
