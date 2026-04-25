// All Appio modals — dispatched via ModalRoot

const ModalRoot = ({ modal, onClose }) => {
  const { key, props } = modal;
  const commonProps = { ...props, onClose };
  switch (key) {
    case 'forgot-password': return <ForgotPasswordModal {...commonProps}/>;
    case 'delete-app':      return <DeleteAppModal {...commonProps}/>;
    case 'unpublish':       return <UnpublishModal {...commonProps}/>;
    case 'restore-version': return <RestoreVersionModal {...commonProps}/>;
    case 'add-feature':     return <AddFeatureModal {...commonProps}/>;
    case 'avatar-upload':   return <AvatarUploadModal {...commonProps}/>;
    case 'custom-domain':   return <CustomDomainModal {...commonProps}/>;
    case 'share-app':       return <ShareAppModal {...commonProps}/>;
    case 'export-repo':     return <ExportRepoModal {...commonProps}/>;
    case 'change-payment':  return <ChangePaymentModal {...commonProps}/>;
    case 'invoices':        return <InvoicesListModal {...commonProps}/>;
    case 'upgrade-plan':    return <UpgradePlanModal {...commonProps}/>;
    case 'fix-with-ai':     return <FixWithAIModal {...commonProps}/>;
    case 'shortcuts':       return <ShortcutsModal {...commonProps}/>;
    case 'change-icon':     return <ChangeIconModal {...commonProps}/>;
    case 'demo':            return <DemoModal {...commonProps}/>;
    default: return null;
  }
};

// ---------- 1.1 Forgot password ----------
const ForgotPasswordModal = ({ onClose, initialEmail = '' }) => {
  const [email, setEmail] = React.useState(initialEmail);
  const [sent, setSent] = React.useState(false);
  return (
    <ModalShell onClose={onClose} width={440}>
      <ModalHeader onClose={onClose} title={sent ? 'Check your inbox' : 'Reset your password'} subtitle={sent ? null : "We'll email you a link to choose a new one."} icon={sent ? 'check' : 'lock'} iconColor={sent ? 'var(--success)' : 'var(--accent)'}/>
      <ModalBody>
        {sent ? (
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
            We sent a reset link to <strong style={{ color: 'var(--text-primary)' }}>{email || 'your email'}</strong>. It expires in 30 minutes.
          </div>
        ) : (
          <>
            <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <Input icon="user" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {sent ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Back to sign in</Button>
            <Button variant="primary" disabled={!email} onClick={() => setSent(true)}>Send reset link</Button>
          </>
        )}
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.2 Delete app confirmation ----------
const DeleteAppModal = ({ onClose, appName = 'Streak' }) => {
  const { toast } = useApp();
  const [input, setInput] = React.useState('');
  const canDelete = input === appName;
  return (
    <ModalShell onClose={onClose} width={440}>
      <ModalHeader onClose={onClose} title={`Delete ${appName}?`} subtitle="This can't be undone. The live URL stops working immediately, and everything below is gone." icon="alert" iconColor="var(--danger)"/>
      <ModalBody>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
          <li>Version history (24 revisions)</li>
          <li>Analytics data from the past 34 days</li>
          <li>Connected Convex database</li>
          <li>Custom domain mappings</li>
        </ul>
        <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Type <span className="t-mono" style={{ color: 'var(--text-primary)' }}>{appName}</span> to confirm</label>
        <Input placeholder={appName} value={input} onChange={e => setInput(e.target.value)}/>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={!canDelete} onClick={() => { onClose(); toast(`${appName} deleted`, { variant: 'danger', action: { label: 'Undo', onClick: () => toast('Restored', { variant: 'success' }) } }); }}>Delete forever</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.3 Unpublish ----------
const UnpublishModal = ({ onClose, appName = 'Streak' }) => {
  const { toast } = useApp();
  return (
    <ModalShell onClose={onClose} width={440}>
      <ModalHeader onClose={onClose} title={`Unpublish ${appName}?`} subtitle="The live URL will stop working. Your draft stays safe — you can republish any time." icon="eye" iconColor="var(--warning)"/>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={() => { onClose(); toast(`${appName} is now private`, { variant: 'warning' }); }}>Unpublish</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.4 Restore version ----------
const RestoreVersionModal = ({ onClose, version = 'v0.3.2' }) => {
  const { toast } = useApp();
  const [saveDraft, setSaveDraft] = React.useState(true);
  return (
    <ModalShell onClose={onClose} width={460}>
      <ModalHeader onClose={onClose} title={`Restore to ${version}?`} subtitle="Your current state can be saved as a draft before rolling back." icon="history"/>
      <ModalBody>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>What will change</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Files rolled back</span><span style={{ fontFamily: 'var(--f-mono)' }}>12</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Screens affected</span><span style={{ fontFamily: 'var(--f-mono)' }}>3 of 5</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="muted">Theme</span><span>Default → Playful</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Save current as draft</div>
            <div className="t-caption" style={{ marginTop: 2 }}>You'll still be able to jump back to it.</div>
          </div>
          <Toggle on={saveDraft} onChange={setSaveDraft}/>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { onClose(); toast(`Restored to ${version}`, { variant: 'success' }); }}>Restore</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.5 Add feature ----------
const AddFeatureModal = ({ onClose }) => {
  const { toast } = useApp();
  const [text, setText] = React.useState('');
  const features = [
    { label: 'New screen',      icon: 'screen',   starter: 'Add a new screen called ' },
    { label: 'Form',            icon: 'panel',    starter: 'Add a form that collects ' },
    { label: 'Chart',           icon: 'chart',    starter: 'Add a chart showing ' },
    { label: 'Image gallery',   icon: 'grid',     starter: 'Add an image gallery for ' },
    { label: 'User profile',    icon: 'user',     starter: 'Add a user profile page with ' },
    { label: 'Comments',        icon: 'chat',     starter: 'Add comments on ' },
    { label: 'Notifications',   icon: 'bell',     starter: 'Add notifications when ' },
    { label: 'Payments',        icon: 'lock',     starter: '', disabled: true },
    { label: 'Custom…',         icon: 'sparkle',  starter: '' },
  ];
  return (
    <ModalShell onClose={onClose} width={640}>
      <ModalHeader onClose={onClose} title="What do you want to add?" subtitle="Describe it, or start from a common pattern." icon="plus"/>
      <ModalBody>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Add a weekly summary email that goes out every Sunday with the user's streak…"
          style={{ width: '100%', background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, padding: 14, fontSize: 14, fontFamily: 'var(--f-ui)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}/>
        <div className="t-overline" style={{ margin: '18px 0 10px' }}>Common patterns</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {features.map(f => (
            <div key={f.label} onClick={f.disabled ? undefined : () => setText(f.starter)} style={{
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8,
              cursor: f.disabled ? 'not-allowed' : 'pointer', opacity: f.disabled ? 0.45 : 1,
              transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => !f.disabled && (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => !f.disabled && (e.currentTarget.style.borderColor = 'var(--hair)')}>
              <Icon name={f.icon} size={16} stroke={f.disabled ? 'var(--text-subtle)' : 'var(--accent)'}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.label}</div>
                {f.disabled && <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 1 }}>Coming soon</div>}
              </div>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="sparkle" disabled={!text.trim()} onClick={() => { onClose(); toast('Thinking about your feature…'); }}>Add</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.6 Avatar upload ----------
const AvatarUploadModal = ({ onClose }) => {
  const { toast } = useApp();
  const [stage, setStage] = React.useState('drop'); // drop | crop
  const [zoom, setZoom] = React.useState(1);
  return (
    <ModalShell onClose={onClose} width={440}>
      <ModalHeader onClose={onClose} title="Upload avatar" subtitle={stage === 'drop' ? 'PNG or JPG, at least 256×256.' : 'Position and zoom to fit the circle.'} icon="user"/>
      <ModalBody>
        {stage === 'drop' ? (
          <div onClick={() => setStage('crop')} style={{
            border: '2px dashed var(--strong)', borderRadius: 12, padding: '40px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: 'var(--surface-0)',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--strong)'}>
            <div style={{ width: 44, height: 44, borderRadius: 12, margin: '0 auto 14px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrowUp" size={18}/>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop an image here</div>
            <div className="t-caption">or click to choose a file</div>
          </div>
        ) : (
          <div>
            <div style={{
              width: 200, height: 200, margin: '0 auto 16px', borderRadius: '50%', overflow: 'hidden',
              background: 'linear-gradient(135deg, #FDE68A, #FCA5A5, #C4B5FD)', position: 'relative',
              boxShadow: '0 0 0 4px var(--surface-0), 0 0 0 5px var(--strong)',
            }}>
              <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: 'center', background: 'inherit' }}/>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(11,11,15,0.5)', fontFamily: 'var(--f-display)', fontSize: 56, fontWeight: 600 }}>C</div>
            </div>
            <label className="t-caption" style={{ display: 'block', marginBottom: 8 }}>Zoom</label>
            <input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }}/>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={stage === 'drop'} onClick={() => { onClose(); toast('Avatar updated', { variant: 'success' }); }}>Save</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.7 Custom domain ----------
const CustomDomainModal = ({ onClose }) => {
  const { toast } = useApp();
  const [step, setStep] = React.useState(1);
  const [domain, setDomain] = React.useState('streak.clara.app');
  const [verifying, setVerifying] = React.useState(false);

  const records = [
    { type: 'A',     host: '@',     value: '76.76.21.21' },
    { type: 'CNAME', host: 'www',   value: 'cname.appio.app' },
  ];

  return (
    <ModalShell onClose={onClose} width={560}>
      <ModalHeader onClose={onClose} title="Add a custom domain" subtitle={`Step ${step} of 3`} icon="globe"/>
      <ModalBody>
        {/* Stepper */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= step ? 'var(--accent)' : 'var(--surface-2)' }}/>
          ))}
        </div>

        {step === 1 && (
          <>
            <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Domain</label>
            <Input icon="link" placeholder="app.yourdomain.com" value={domain} onChange={e => setDomain(e.target.value)}/>
            <div className="t-caption" style={{ marginTop: 10 }}>You'll need access to your DNS provider (Cloudflare, Namecheap, etc) to finish.</div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 13, marginBottom: 12, color: 'var(--text-muted)' }}>Add these records in your DNS provider's dashboard.</div>
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, overflow: 'hidden' }}>
              {records.map((r, i) => (
                <div key={i} style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '50px 70px 1fr auto', gap: 12, alignItems: 'center', borderBottom: i === records.length - 1 ? 'none' : '1px solid var(--hair)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
                  <span style={{ color: 'var(--accent)' }}>{r.type}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{r.host}</span>
                  <span>{r.value}</span>
                  <Icon name="copy" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => toast('Copied to clipboard', { variant: 'success' })}/>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {verifying ? (
              <>
                <div style={{ width: 48, height: 48, margin: '0 auto 16px', borderRadius: '50%', border: '3px solid var(--hair)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }}/>
                <div style={{ fontSize: 14 }}>Verifying DNS records…</div>
                <div className="t-caption" style={{ marginTop: 4 }}>This can take up to a minute.</div>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={28} strokeWidth={2.5}/>
                </div>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{domain} is live</div>
                <div className="t-caption">SSL certificate issued automatically.</div>
              </>
            )}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {step > 1 && step < 3 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
        {step === 1 && <Button variant="ghost" onClick={onClose}>Cancel</Button>}
        {step < 2 && <Button variant="primary" disabled={!domain} onClick={() => setStep(step + 1)}>Continue</Button>}
        {step === 2 && <Button variant="primary" onClick={() => { setStep(3); setVerifying(true); setTimeout(() => setVerifying(false), 1800); }}>Verify</Button>}
        {step === 3 && !verifying && <Button variant="primary" onClick={() => { onClose(); toast(`${domain} connected`, { variant: 'success' }); }}>Done</Button>}
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.8 Share app ----------
const ShareAppModal = ({ onClose, appName = 'Streak', url = 'streak.appio.app' }) => {
  const { toast } = useApp();
  const fullUrl = `https://${url}`;
  const embed = `<iframe src="${fullUrl}" width="400" height="700" frameborder="0"></iframe>`;
  return (
    <ModalShell onClose={onClose} width={520}>
      <ModalHeader onClose={onClose} title={`Share ${appName}`} subtitle="Anyone with the link can use it." icon="share"/>
      <ModalBody>
        {/* URL row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <div style={{ flex: 1, padding: '8px 12px', background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, fontFamily: 'var(--f-mono)', fontSize: 13, display: 'flex', alignItems: 'center' }}>{fullUrl}</div>
          <Button variant="secondary" icon="copy" onClick={() => { navigator.clipboard?.writeText(fullUrl); toast('Link copied', { variant: 'success' }); }}>Copy</Button>
        </div>

        {/* QR + embed side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ background: '#fff', padding: 8, borderRadius: 8, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeFaux/>
          </div>
          <div>
            <div className="t-overline" style={{ marginBottom: 8 }}>Embed</div>
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, padding: 10, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, wordBreak: 'break-all', position: 'relative' }}>
              {embed}
              <Icon name="copy" size={13} stroke="var(--text-muted)" style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(embed); toast('Embed copied', { variant: 'success' }); }}/>
            </div>
          </div>
        </div>

        {/* Social quick-shares */}
        <div className="t-overline" style={{ marginBottom: 10 }}>Share to</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Twitter', 'LinkedIn', 'Email'].map(p => (
            <Button key={p} variant="secondary" size="sm" onClick={() => toast(`Opening ${p}…`)}>{p}</Button>
          ))}
        </div>
      </ModalBody>
    </ModalShell>
  );
};

// Faux QR code (deterministic pattern)
const QRCodeFaux = ({ size = 96 }) => {
  const cells = 21;
  const cellSize = size / cells;
  const pattern = React.useMemo(() => {
    const grid = Array.from({ length: cells * cells }, (_, i) => {
      const x = i % cells, y = Math.floor(i / cells);
      // finder squares
      if ((x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7)) {
        const inFinder = (cx, cy) => {
          const lx = x - cx, ly = y - cy;
          return Math.max(Math.abs(lx - 3), Math.abs(ly - 3)) <= 3 && Math.max(Math.abs(lx - 3), Math.abs(ly - 3)) !== 2;
        };
        if (inFinder(0,0) || inFinder(cells-7,0) || inFinder(0,cells-7)) return 1;
        return 0;
      }
      return (Math.sin(x * 31 + y * 73) > 0) ? 1 : 0;
    });
    return grid;
  }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {pattern.map((v, i) => v && (
        <rect key={i} x={(i % cells) * cellSize} y={Math.floor(i / cells) * cellSize} width={cellSize} height={cellSize} fill="#000"/>
      ))}
    </svg>
  );
};

// ---------- 1.9 Export repo ----------
const ExportRepoModal = ({ onClose }) => {
  const { toast } = useApp();
  const [connected, setConnected] = React.useState(true);
  const [repoName, setRepoName] = React.useState('streak');
  const [vis, setVis] = React.useState('private');
  const [stage, setStage] = React.useState('form'); // form | success
  return (
    <ModalShell onClose={onClose} width={480}>
      <ModalHeader onClose={onClose} title="Export to GitHub" subtitle={stage === 'success' ? 'Your repo is live.' : 'Push your app as a real Git repository.'} icon="github"/>
      <ModalBody>
        {!connected ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Icon name="github" size={36} stroke="var(--text-primary)"/>
            <div style={{ fontSize: 14, marginTop: 12, marginBottom: 18 }}>Connect GitHub to export code.</div>
            <Button variant="primary" icon="github" onClick={() => setConnected(true)}>Connect GitHub</Button>
          </div>
        ) : stage === 'form' ? (
          <>
            <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Repository name</label>
            <Input icon="github" value={repoName} onChange={e => setRepoName(e.target.value)}/>
            <div style={{ marginTop: 16 }}>
              <label className="t-caption" style={{ display: 'block', marginBottom: 8 }}>Visibility</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['private', 'lock', 'Private'], ['public', 'globe', 'Public']].map(([k, icon, label]) => (
                  <div key={k} onClick={() => setVis(k)} style={{
                    flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                    border: `1px solid ${vis === k ? 'var(--accent)' : 'var(--hair)'}`,
                    background: vis === k ? 'var(--accent-soft)' : 'var(--surface-0)',
                    color: vis === k ? 'var(--accent-ink)' : 'var(--text-primary)',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}>
                    <Icon name={icon} size={14}/>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={28} strokeWidth={2.5}/>
            </div>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, marginBottom: 6 }}>Pushed {repoName}</div>
            <a style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              github.com/claraj/{repoName} <Icon name="external" size={12}/>
            </a>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {stage === 'form' && connected && (<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="github" disabled={!repoName} onClick={() => { setStage('success'); }}>Create and push</Button>
        </>)}
        {stage === 'success' && <Button variant="primary" onClick={() => { onClose(); toast('Pushed to GitHub', { variant: 'success' }); }}>Done</Button>}
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.11 Change payment ----------
const ChangePaymentModal = ({ onClose }) => {
  const { toast } = useApp();
  const [num, setNum] = React.useState('');
  const [exp, setExp] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  return (
    <ModalShell onClose={onClose} width={460}>
      <ModalHeader onClose={onClose} title="Update payment" subtitle="Replacing: Visa ending 4242" icon="lock"/>
      <ModalBody>
        <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Card number</label>
        <Input placeholder="1234 1234 1234 1234" value={num} onChange={e => setNum(e.target.value)}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div>
            <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>Expiry</label>
            <Input placeholder="MM/YY" value={exp} onChange={e => setExp(e.target.value)}/>
          </div>
          <div>
            <label className="t-caption" style={{ display: 'block', marginBottom: 6 }}>CVC</label>
            <Input placeholder="123" value={cvc} onChange={e => setCvc(e.target.value)}/>
          </div>
        </div>
        <label className="t-caption" style={{ display: 'block', marginTop: 14, marginBottom: 6 }}>Country</label>
        <div style={{ height: 36, padding: '0 12px', background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 'var(--r-input)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
          <span>United States</span>
          <Icon name="chevronDown" size={14} stroke="var(--text-muted)"/>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { onClose(); toast('Payment method updated', { variant: 'success' }); }}>Save</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.12 Invoices list ----------
const InvoicesListModal = ({ onClose }) => {
  const { toast } = useApp();
  const months = ['April','March','February','January','December','November','October','September','August','July','June','May'];
  const years =  [2026,   2026,   2026,       2026,     2025,       2025,       2025,      2025,        2025,    2025,   2025,  2025];
  const invoices = months.map((m, i) => ({
    month: `${m} ${years[i]}`, amount: i === 0 ? 'Pending' : `$${20 + (i % 3) * 5}.00`,
    status: i === 0 ? 'open' : 'paid',
  }));
  return (
    <ModalShell onClose={onClose} width={560}>
      <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)' }}>
        <div>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 600 }}>Invoices</div>
          <div className="t-caption" style={{ marginTop: 2 }}>All past statements</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span onClick={() => toast('Downloading ZIP…')} style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>Download all</span>
          <Icon name="x" size={18} stroke="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose}/>
        </div>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {invoices.map((inv, i) => (
          <div key={i} style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i === invoices.length - 1 ? 'none' : '1px solid var(--hair)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{inv.month}</div>
              <div className="t-caption" style={{ marginTop: 2 }}>Pro plan · monthly</div>
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13, minWidth: 80, textAlign: 'right' }}>{inv.amount}</div>
            <Chip variant={inv.status === 'paid' ? 'ready' : 'idle'} size="sm">{inv.status === 'paid' ? 'Paid' : 'Open'}</Chip>
            <Icon name="download" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => toast('Invoice downloaded', { variant: 'success' })}/>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};

// ---------- 1.13 Upgrade/downgrade ----------
const UpgradePlanModal = ({ onClose, direction = 'up', plan = 'Pro' }) => {
  const { toast } = useApp();
  const isUp = direction === 'up';
  return (
    <ModalShell onClose={onClose} width={460}>
      <ModalHeader onClose={onClose} title={isUp ? `Upgrade to ${plan}` : `Downgrade to ${plan}`} subtitle={isUp ? 'Takes effect immediately.' : 'Takes effect at the end of your current cycle (April 30).'} icon={isUp ? 'arrowUp' : 'chevronDown'} iconColor={isUp ? 'var(--success)' : 'var(--warning)'}/>
      <ModalBody>
        <div className="t-overline" style={{ marginBottom: 10 }}>{isUp ? "You'll get" : "You'll lose"}</div>
        <ul style={{ margin: '0 0 18px', paddingLeft: 0, listStyle: 'none', fontSize: 13, lineHeight: 1.9 }}>
          {(isUp
            ? ['Unlimited apps', '2,000 AI generations per month', 'Team seats (up to 5)', 'Priority support', 'Custom domains']
            : ['Team seats', 'Priority support', 'Custom domains'])
            .map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name={isUp ? 'check' : 'x'} size={14} stroke={isUp ? 'var(--success)' : 'var(--danger)'} strokeWidth={2}/>
                {f}
              </li>
          ))}
        </ul>
        {isUp && (
          <div style={{ background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Prorated today</div>
              <div className="t-caption" style={{ marginTop: 2 }}>Billed to Visa ·· 4242</div>
            </div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 16, fontWeight: 600 }}>$17.34</div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={isUp ? 'primary' : 'secondary'} onClick={() => { onClose(); toast(isUp ? `Upgraded to ${plan}` : `Downgrade scheduled`, { variant: isUp ? 'success' : 'warning' }); }}>
          {isUp ? 'Confirm upgrade' : 'Confirm downgrade'}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.14 Fix with AI ----------
const FixWithAIModal = ({ onClose }) => {
  const { toast } = useApp();
  const [selected, setSelected] = React.useState(null);
  const approaches = [
    { title: 'Split it into two steps', body: "First add the data model, then build the UI that reads it. Smaller scope per step." },
    { title: 'Start from a template', body: 'Use the Habit Tracker template as a base and modify from there.' },
    { title: 'Skip the contested change', body: 'Roll back your last prompt and try a gentler request.' },
  ];
  return (
    <ModalShell onClose={onClose} width={520}>
      <ModalHeader onClose={onClose} title="Let me try a different approach" subtitle="Pick a direction and I'll retry." icon="wand"/>
      <ModalBody>
        {approaches.map((a, i) => (
          <div key={i} onClick={() => setSelected(i)} style={{
            padding: 14, marginBottom: 8,
            background: 'var(--surface-0)',
            border: `1px solid ${selected === i ? 'var(--accent)' : 'var(--hair)'}`,
            borderRadius: 10, cursor: 'pointer',
            transition: 'all var(--t-fast)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{a.title}</div>
            <div className="t-caption" style={{ lineHeight: 1.6 }}>{a.body}</div>
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="sparkle" disabled={selected === null} onClick={() => { onClose(); toast('Retrying with a different approach…'); }}>Retry with this approach</Button>
      </ModalFooter>
    </ModalShell>
  );
};

// ---------- 1.15 Shortcuts ----------
const ShortcutsModal = ({ onClose }) => {
  const Kbd = ({ children }) => (
    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, padding: '3px 7px', background: 'var(--surface-2)', border: '1px solid var(--strong)', borderRadius: 4, color: 'var(--text-primary)' }}>{children}</span>
  );
  const groups = [
    { title: 'Global', items: [
      ['⌘ K', 'Command palette'],
      ['J / K', 'Navigate frames'],
      ['? ', 'This help'],
      ['Esc', 'Close modal'],
    ]},
    { title: 'Builder', items: [
      ['⌘ Enter', 'Send chat message'],
      ['⌘ /', 'Focus chat'],
      ['⌘ S', 'Save version'],
      ['⌘ P', 'Publish'],
    ]},
    { title: 'Dashboard', items: [
      ['N', 'New app'],
      ['/', 'Search'],
      ['G P', 'Go to projects'],
    ]},
  ];
  return (
    <ModalShell onClose={onClose} width={620}>
      <ModalHeader onClose={onClose} title="Keyboard shortcuts" icon="code"/>
      <ModalBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {groups.map(g => (
            <div key={g.title}>
              <div className="t-overline" style={{ marginBottom: 10 }}>{g.title}</div>
              {g.items.map(([k, label]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                  <span>{label}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ModalBody>
    </ModalShell>
  );
};

// ---------- 1.16 Change icon ----------
const ChangeIconModal = ({ onClose }) => {
  const { toast } = useApp();
  const [tab, setTab] = React.useState('emoji');
  const [prompt, setPrompt] = React.useState('');
  const emojis = ['⚡','🔥','🌿','📚','🏋️','💊','🪴','🌅','☕','📝','🎯','🎨','🎧','🎬','🎮','🍞','🧁','🍰','🍕','🍜','📸','🌸','🌊','🏔️','✨','💜','💛','❤️','⭐','🌙','☀️','🪄','📓','📌','🔖','🎁','🏆','🧭','🗺️','🎲','🃏','🎭','📣','📮','📷','🎤','🎹','🎸','🎷','🎺','🌼','🌻','🌺','🌷','🍀','🍃','🍂','🌾','🌳','🎋'];
  return (
    <ModalShell onClose={onClose} width={560}>
      <ModalHeader onClose={onClose} title="Change app icon" icon="palette"/>
      <ModalBody>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 6, width: 'fit-content', marginBottom: 18 }}>
          {[['emoji','Emoji'],['upload','Upload'],['ai','Generate']].map(([k,l]) => (
            <div key={k} onClick={() => setTab(k)} style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              background: tab === k ? 'var(--surface-0)' : 'transparent',
              color: tab === k ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: tab === k ? 500 : 400,
            }}>{l}</div>
          ))}
        </div>
        {tab === 'emoji' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {emojis.map(e => (
              <div key={e} onClick={() => { onClose(); toast(`Icon changed to ${e}`, { variant: 'success' }); }}
                style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, borderRadius: 6, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {e}
              </div>
            ))}
          </div>
        )}
        {tab === 'upload' && (
          <div style={{ border: '2px dashed var(--strong)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer' }}>
            <Icon name="arrowUp" size={24} stroke="var(--text-muted)"/>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 10, marginBottom: 4 }}>Drop a 512×512 PNG</div>
            <div className="t-caption">Transparent backgrounds supported.</div>
          </div>
        )}
        {tab === 'ai' && (
          <>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="A flame that feels calm, not aggressive."
              style={{ width: '100%', background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'var(--f-ui)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
              {['🔥','⚡','✨','💫'].map(e => (
                <div key={e} style={{ aspectRatio: '1', background: 'var(--surface-0)', border: '1px solid var(--hair)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, cursor: 'pointer' }}>
                  {prompt ? e : '·'}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" icon="sparkle" disabled={!prompt} full>Generate 4 options</Button>
            </div>
          </>
        )}
      </ModalBody>
    </ModalShell>
  );
};

// ---------- Demo modal (Landing "Watch demo") ----------
const DemoModal = ({ onClose }) => {
  const screens = ['home', 'detail', 'stats', 'profile'];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % screens.length), 1500);
    return () => clearInterval(t);
  }, []);
  const diffs = [
    { kind: 'added',   title: 'Added: 4 habit cards', files: 'Home.tsx, HabitCard.tsx' },
    { kind: 'changed', title: 'Updated: streak tints', files: 'theme.ts' },
    { kind: 'added',   title: 'Added: stats screen',  files: 'Stats.tsx' },
    { kind: 'changed', title: 'Updated: profile',     files: 'Profile.tsx' },
  ];
  return (
    <ModalShell onClose={onClose} width={780}>
      <ModalHeader onClose={onClose} title="40 seconds with Appio" subtitle="Watch how a habit tracker gets built." icon="sparkle"/>
      <ModalBody style={{ background: 'var(--surface-0)', padding: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <IPhoneFrame width={220}>
              <StreakApp screen={screens[idx]} scale={220/393}/>
            </IPhoneFrame>
          </div>
          <div>
            {diffs.map((d, i) => (
              <div key={i} style={{ opacity: i <= idx ? 1 : 0.3, transition: 'opacity 280ms', marginBottom: 8 }}>
                <DiffCard {...d}/>
              </div>
            ))}
          </div>
        </div>
      </ModalBody>
    </ModalShell>
  );
};

Object.assign(window, {
  ModalRoot,
  ForgotPasswordModal, DeleteAppModal, UnpublishModal, RestoreVersionModal,
  AddFeatureModal, AvatarUploadModal, CustomDomainModal, ShareAppModal,
  ExportRepoModal, ChangePaymentModal, InvoicesListModal, UpgradePlanModal,
  FixWithAIModal, ShortcutsModal, ChangeIconModal, DemoModal, QRCodeFaux,
});
