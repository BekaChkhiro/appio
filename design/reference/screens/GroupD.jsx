// Group D — Publish flow (interactive)

const PrePublishScreen = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <PublishHeader step={0}/>
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'auto' }}>
      <div className="scroll" style={{ padding: '48px 64px', overflow: 'auto' }}>
        <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 10 }}>Pre-publish review</div>
        <div className="t-display-lg" style={{ marginBottom: 8 }}>Ready to go live?</div>
        <div className="t-body-lg muted" style={{ maxWidth: 480, marginBottom: 40 }}>
          Here's what will ship. You can come back and keep building after — publishing doesn't freeze anything.
        </div>

        <SummaryRow label="App name" value="Streak" editable/>
        <SummaryRow label="Theme"    value="Default (dark, violet accent)"/>
        <SummaryRow label="Screens"  value="5 screens"/>
        <SummaryRow label="Features" value="Habits · Streaks · Stats · Daily reset"/>
        <SummaryRow label="Database" value="Your Convex · not yet connected" warning/>
        <SummaryRow label="URL"      value="streak-clara.appio.app"/>

        <div style={{ marginTop: 48, display: 'flex', gap: 12 }}>
          <Button variant="ghost" icon="chevronLeft">Back to builder</Button>
          <Button variant="primary" size="lg" trailingIcon="arrowRight">Connect Convex &amp; publish</Button>
        </div>
      </div>
      <div style={{ borderLeft: '1px solid var(--hair)', padding: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)' }}>
        <div>
          <IPhoneFrame width={280}><StreakApp screen="home" theme="default" scale={280/393}/></IPhoneFrame>
          <div className="t-caption" style={{ textAlign: 'center', marginTop: 20 }}>Preview of your home screen</div>
        </div>
      </div>
    </div>
  </div>
);

const SummaryRow = ({ label, value, editable, warning }) => (
  <div style={{ padding: '18px 0', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div className="t-caption" style={{ width: 140, flexShrink: 0 }}>{label}</div>
    <div style={{ flex: 1, fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
      {warning && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }}/>}
      {value}
    </div>
    {editable && <Icon name="chevronRight" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }}/>}
  </div>
);

const PublishHeader = ({ step }) => {
  const steps = ['Review', 'Connect', 'Publish', 'Done'];
  return (
    <div style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--hair)', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoMark size={20}/>
        <span style={{ fontFamily: 'var(--f-display)', fontSize: 16, fontWeight: 600 }}>Streak</span>
        <span className="t-caption" style={{ marginLeft: 4 }}>/ publish</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: i <= step ? 'var(--text-primary)' : 'var(--text-subtle)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? 'var(--accent)' : i === step ? 'var(--accent-soft)' : 'var(--surface-2)', color: i < step ? '#fff' : i === step ? 'var(--accent)' : 'var(--text-subtle)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--f-mono)' }}>
                {i < step ? <Icon name="check" size={12} stroke="#fff" strokeWidth={2.5}/> : i + 1}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--hair)' }}/>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ---------- Convex OAuth ----------
const ConvexConnectScreen = () => {
  const [connecting, setConnecting] = React.useState(false);
  return (
    <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
      <PublishHeader step={1}/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <Icon name="convex" size={32}/>
          </div>
          <div className="t-display" style={{ marginBottom: 16 }}>Connect your Convex.</div>
          <div className="t-body-lg muted" style={{ marginBottom: 32 }}>
            Appio hosts the front-end. Your app's data — users, habits, everything — lives in a Convex account you own. Two clicks and it's yours forever.
          </div>

          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            {[
              { icon: 'lock', title: 'Your data, never ours', body: "We don't store or read it. The credentials go straight from your browser to Convex." },
              { icon: 'unlock', title: 'Portable on day one', body: 'If you export the repo, it points at the same Convex. No migration.' },
              { icon: 'globe', title: 'Free tier is enough', body: 'Free on Convex covers several hundred daily users for most apps.' },
            ].map(r => (
              <div key={r.title} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--hair)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={r.icon} size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                  <div className="t-caption" style={{ marginTop: 2 }}>{r.body}</div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="primary" size="lg" full icon="convex" loading={connecting} onClick={() => setConnecting(true)}>
            {connecting ? 'Opening Convex…' : 'Connect Convex'}
          </Button>
          <div className="t-caption" style={{ textAlign: 'center', marginTop: 16 }}>
            Don't have a Convex account? <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>One gets created for you.</a>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Publishing in progress ----------
const PublishingScreen = () => {
  const [step, setStep] = React.useState(1);
  const [logs, setLogs] = React.useState(['[00:00] Starting deploy…']);
  const stepsDef = [
    { id: 0, label: 'Connecting Convex' },
    { id: 1, label: 'Provisioning' },
    { id: 2, label: 'Migrating data' },
    { id: 3, label: 'Building' },
    { id: 4, label: 'Deploying' },
  ];

  React.useEffect(() => {
    const timers = [];
    const sched = [
      { delay: 1200, msg: '[00:01] Provisioned streak-clara.appio.app', step: 2 },
      { delay: 2400, msg: '[00:02] Schema migrated · 4 tables · 0 seed rows', step: 3 },
      { delay: 3600, msg: '[00:03] Building: npm install · 412 packages', step: 3 },
      { delay: 5000, msg: '[00:05] Building: vite build · 1.2mb gzipped', step: 4 },
      { delay: 6800, msg: '[00:07] Deploying to edge · 14 regions', step: 4 },
      { delay: 8000, msg: '[00:08] Live.', step: 5 },
    ];
    sched.forEach(s => timers.push(setTimeout(() => {
      setLogs(l => [...l, s.msg]);
      setStep(s.step);
    }, s.delay)));
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
      <PublishHeader step={2}/>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
        <div style={{ padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 10 }}>Publishing</div>
          <div className="t-display" style={{ marginBottom: 8 }}>{step < 5 ? 'Going live…' : 'Live.'}</div>
          <div className="t-caption muted" style={{ marginBottom: 32 }}>This usually takes under 30 seconds.</div>

          {stepsDef.map(s => {
            const status = step > s.id ? 'done' : step === s.id ? 'active' : 'pending';
            return (
              <div key={s.id} style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--hair)' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: status === 'done' ? '#fff' : status === 'active' ? 'var(--accent)' : 'var(--text-subtle)',
                }}>
                  {status === 'done' ? <Icon name="check" size={12} stroke="#fff" strokeWidth={2.5}/> :
                   status === 'active' ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulseDot 1.4s ease-in-out infinite' }}/> :
                   <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-subtle)' }}/>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{s.label}</span>
                {status === 'active' && <span className="t-mono-sm" style={{ marginLeft: 'auto', color: 'var(--accent)' }}>running…</span>}
              </div>
            );
          })}
        </div>
        <div style={{ background: 'var(--surface-1)', borderLeft: '1px solid var(--hair)', padding: 32, display: 'flex', flexDirection: 'column' }}>
          <div className="t-overline" style={{ marginBottom: 16 }}>Live log</div>
          <div className="scroll" style={{ flex: 1, background: 'var(--surface-0)', borderRadius: 8, padding: 16, fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--text-muted)', overflow: 'auto' }}>
            {logs.map((l, i) => (
              <div key={i} style={{ padding: '2px 0', color: i === logs.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{l}</div>
            ))}
            {step < 5 && <div style={{ padding: '2px 0' }}>_<span style={{ animation: 'streamBlink 0.9s infinite' }}>▊</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Published success ----------
const PublishedScreen = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <PublishHeader step={3}/>
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
      <div style={{ padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--success)', marginBottom: 16 }}>
          <Icon name="check" size={16} strokeWidth={2.5}/>
          <span className="t-overline" style={{ color: 'var(--success)' }}>Published</span>
        </div>
        <div className="t-display-lg" style={{ marginBottom: 12 }}>Streak is live.</div>
        <div className="t-body-lg muted" style={{ maxWidth: 460, marginBottom: 32 }}>
          Your app is at the URL below. Share it, install it to your home screen, or keep shaping it — changes you publish next will roll out to the same link.
        </div>

        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="globe" size={16} stroke="var(--accent)"/>
          <span className="t-mono" style={{ flex: 1, color: 'var(--text-primary)' }}>streak-clara.appio.app</span>
          <Icon name="copy" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }}/>
          <Icon name="external" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }}/>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <Button variant="primary" icon="share">Share</Button>
          <Button variant="secondary" icon="download">Save QR</Button>
          <Button variant="ghost" icon="phone">How to install</Button>
        </div>

        <div className="t-caption" style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--hair)' }}>
          What's next? <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>Track usage →</a>  ·  <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>Add a custom domain →</a>
        </div>
      </div>

      <div style={{ background: 'var(--surface-1)', borderLeft: '1px solid var(--hair)', padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <IPhoneFrame width={280}><StreakApp screen="home" theme="default" scale={280/393}/></IPhoneFrame>
        <div>
          <div className="t-caption" style={{ marginBottom: 10 }}>Scan to install</div>
          <div style={{ width: 160, height: 160, background: '#fff', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FakeQR/>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const FakeQR = () => {
  // generate deterministic-ish qr-like pattern
  const cells = [];
  const seed = 42;
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const innerCorner = (x >= 2 && x <= 4 && y >= 2 && y <= 4) || (x >= 16 && x <= 18 && y >= 2 && y <= 4) || (x >= 2 && x <= 4 && y >= 16 && y <= 18);
      const outerCorner = corner && !((x === 1 || x === 5 || x === 15 || x === 19) && y < 7) && !((y === 1 || y === 5) && x < 7) && !((y === 15 || y === 19) && x < 7) && !((x === 15 || x === 19) && y < 7);
      let black = corner && (outerCorner || innerCorner);
      if (!corner) {
        black = ((x * 13 + y * 7 + seed) % 3 === 0);
      }
      cells.push(<div key={`${x}-${y}`} style={{ background: black ? '#000' : '#fff' }}/>);
    }
  }
  return <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(21, 1fr)', gridTemplateRows: 'repeat(21, 1fr)', gap: 0 }}>{cells}</div>;
};

Object.assign(window, { PrePublishScreen, ConvexConnectScreen, PublishingScreen, PublishedScreen, PublishHeader });
