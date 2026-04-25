// Extended screens — Templates, Pricing, Changelog, Roadmap, Account sub-pages, Placeholders

// ---------- Shared footer + nav helper ----------
const MarketingNav = ({ active }) => {
  const { navigate } = useApp();
  const items = [
    { id: 'landing',   label: 'Product' },
    { id: 'templates', label: 'Showcase' },
    { id: 'pricing',   label: 'Pricing' },
    { id: 'changelog', label: 'Changelog' },
  ];
  return (
    <div style={{ padding: '16px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)', background: 'var(--surface-0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div onClick={() => navigate('landing')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <LogoMark size={22}/>
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 17, fontWeight: 600 }}>Appio</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {items.map(i => (
            <div key={i.id} onClick={() => navigate(i.id)} style={{
              padding: '6px 12px', fontSize: 13, fontWeight: 500,
              color: active === i.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderRadius: 6, cursor: 'pointer',
            }}>{i.label}</div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('signin')}>Sign in</Button>
        <Button variant="primary" size="sm" onClick={() => navigate('onb-welcome')}>Start building</Button>
      </div>
    </div>
  );
};

const MarketingFooter = () => {
  const { navigate } = useApp();
  const cols = [
    { title: 'Product',  items: [['Features','landing'],['Templates','templates'],['Pricing','pricing'],['Changelog','changelog']] },
    { title: 'Company',  items: [['About','about'],['Blog','blog'],['Roadmap','roadmap'],['Community','community']] },
    { title: 'Resources',items: [['Docs','docs'],['Support','support'],['Showcase','templates']] },
    { title: 'Legal',    items: [['Privacy','privacy'],['Terms','terms']] },
  ];
  return (
    <div style={{ borderTop: '1px solid var(--hair)', padding: '48px 48px 32px', background: 'var(--surface-0)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(4, 1fr)', gap: 40, marginBottom: 36 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <LogoMark size={22}/>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 17, fontWeight: 600 }}>Appio</span>
          </div>
          <div className="t-caption" style={{ maxWidth: 260, lineHeight: 1.6 }}>Describe an app. Ship it. Keep iterating.</div>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <div className="t-overline" style={{ marginBottom: 12 }}>{c.title}</div>
            {c.items.map(([label, target]) => (
              <div key={label} onClick={() => navigate(target)} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                {label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 24, borderTop: '1px solid var(--hair)', fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--f-mono)' }}>
        <span>© 2026 Appio — Crafted in public.</span>
        <span>v0.14.2</span>
      </div>
    </div>
  );
};

// ============================================================
// 2.1 Templates Gallery
// ============================================================
const TemplatesScreen = () => {
  const { navigate } = useApp();
  const [cat, setCat] = React.useState('all');
  const categories = ['all','Productivity','Content','Community','Commerce','Tracking'];
  const themes = ['default','editorial-serif','brutalist-bold','minimal-mono','vibrant-gradient','glassmorphic-soft'];
  const tints = ['#7C5CFF','#FDE68A','#FCA5A5','#C4B5FD','#6EE7B7','#F5A524'];
  const screens = ['home','stats','profile','detail','add','home'];
  const templates = [
    { name: 'Streak',           category: 'Tracking',     creator: 'Clara J.',  remixes: '2.1k' },
    { name: 'Morning Pages',    category: 'Content',      creator: 'Dev L.',    remixes: '980' },
    { name: 'Iron Week',        category: 'Tracking',     creator: 'Marco S.',  remixes: '1.2k' },
    { name: 'Pan & Co',         category: 'Commerce',     creator: 'Sofia K.',  remixes: '540' },
    { name: 'Link-in-bio',      category: 'Content',      creator: 'Dev L.',    remixes: '3.4k' },
    { name: 'Recipe Box',       category: 'Content',      creator: 'Sofia K.',  remixes: '820' },
    { name: 'Standup Notes',    category: 'Productivity', creator: 'Teamful',   remixes: '1.7k' },
    { name: 'Reading List',     category: 'Productivity', creator: 'Clara J.',  remixes: '2.8k' },
    { name: 'Event RSVP',       category: 'Community',    creator: 'Marco S.',  remixes: '670' },
    { name: 'Plant Care',       category: 'Tracking',     creator: 'Clara J.',  remixes: '1.1k' },
    { name: 'Workout Buddy',    category: 'Tracking',     creator: 'Marco S.',  remixes: '930' },
    { name: 'Pomodoro',         category: 'Productivity', creator: 'Dev L.',    remixes: '1.9k' },
    { name: 'Coffee Subscription', category: 'Commerce',  creator: 'Pan & Co',  remixes: '420' },
    { name: 'Book Club',        category: 'Community',    creator: 'Clara J.',  remixes: '510' },
    { name: 'Hike Log',         category: 'Tracking',     creator: 'Marco S.',  remixes: '760' },
    { name: 'Mood Journal',     category: 'Content',      creator: 'Dev L.',    remixes: '1.5k' },
    { name: 'Wedding RSVP',     category: 'Community',    creator: 'Sofia K.',  remixes: '380' },
    { name: 'Product Waitlist', category: 'Commerce',     creator: 'Teamful',   remixes: '920' },
    { name: 'Habit Reset',      category: 'Tracking',     creator: 'Clara J.',  remixes: '1.3k' },
    { name: 'Daily Standup',    category: 'Productivity', creator: 'Teamful',   remixes: '2.4k' },
  ];
  const filtered = cat === 'all' ? templates : templates.filter(t => t.category === cat);
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <MarketingNav active="templates"/>
      <div style={{ padding: '56px 48px 0', maxWidth: 1280, margin: '0 auto' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>Showcase</div>
        <div className="t-display" style={{ marginBottom: 12 }}>230 apps. All remixable.</div>
        <div className="t-body-lg muted" style={{ maxWidth: 560 }}>Every template is a real app someone shipped. Fork one, make it yours in an afternoon.</div>
      </div>
      <div style={{ padding: '32px 48px 48px', maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 40 }}>
        {/* Filters */}
        <div>
          <Input icon="search" placeholder="Search templates" style={{ marginBottom: 20 }}/>
          <div className="t-overline" style={{ marginBottom: 10 }}>Categories</div>
          {categories.map(c => (
            <div key={c} onClick={() => setCat(c)} style={{
              padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
              fontSize: 13, background: cat === c ? 'var(--surface-2)' : 'transparent',
              color: cat === c ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: cat === c ? 500 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{c === 'all' ? 'All' : c}</span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--f-mono)' }}>
                {c === 'all' ? templates.length : templates.filter(t => t.category === c).length}
              </span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {filtered.map((t, i) => (
            <div key={t.name} onClick={() => navigate('builder')} style={{
              background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 12,
              overflow: 'hidden', cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hair)'}>
              <div style={{ aspectRatio: '4/3.2', background: `linear-gradient(160deg, ${tints[i % tints.length]}12, var(--surface-0))`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid var(--hair)' }}>
                <div style={{ transform: 'translateY(18%)' }}>
                  <IPhoneFrame width={120}>
                    <StreakApp screen={screens[i % screens.length]} theme={themes[i % themes.length]} scale={120/393}/>
                  </IPhoneFrame>
                </div>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                  <span className="t-mono-sm" style={{ color: 'var(--text-subtle)' }}>{t.category}</span>
                </div>
                <div className="t-caption">by {t.creator} · {t.remixes} remixes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <MarketingFooter/>
    </div>
  );
};

// ============================================================
// 2.2 Pricing
// ============================================================
const PricingScreen = () => {
  const { openModal } = useApp();
  const plans = [
    { name: 'Free', price: '$0', per: 'forever', cta: 'Start free', variant: 'secondary',
      features: ['1 published app','50 AI generations / month','Appio subdomain','Community support'] },
    { name: 'Pro',  price: '$20', per: 'per month', cta: 'Upgrade to Pro', variant: 'primary', highlight: true,
      features: ['Unlimited apps','2,000 AI generations / month','Custom domains','Email support','Export to GitHub'] },
    { name: 'Studio',price: '$80', per: 'per month', cta: 'Contact sales', variant: 'secondary',
      features: ['Everything in Pro','5 team seats','Private templates','Priority support','Advanced analytics'] },
  ];

  const compareRows = [
    ['Apps',                          '1', 'Unlimited', 'Unlimited'],
    ['AI generations / month',        '50', '2,000', '10,000'],
    ['Published URL',                 'apps.appio.app/…', 'Custom domain', 'Custom domain'],
    ['Team seats',                    '—', '1', '5'],
    ['Export to GitHub',              '—', '✓', '✓'],
    ['Password-protect apps',         '—', '✓', '✓'],
    ['Convex database',               '✓', '✓', '✓'],
    ['Version history',               '10 versions', 'Unlimited', 'Unlimited'],
    ['Analytics retention',           '7 days', '90 days', '1 year'],
    ['Support',                       'Community', 'Email', 'Priority'],
    ['Private templates',             '—', '—', '✓'],
    ['SSO',                           '—', '—', 'Add-on'],
  ];

  const faqs = [
    ['What counts as an AI generation?', 'Each time Appio writes or rewrites code for you — one prompt equals one generation.'],
    ['Can I switch plans any time?',     'Yes. Upgrades take effect immediately and are prorated. Downgrades happen at the end of your cycle.'],
    ['What happens to my app if I downgrade?', "Your app stays published. If you exceed Free limits, generations pause until next month — but published URLs keep working."],
    ['Do you have a student discount?',  'Yes — 50% off Pro with a valid .edu email. Write to hello@appio.app.'],
    ['Can I cancel any time?',           "Yes. Your plan stays active until the end of your billing cycle, then drops to Free. You never lose your apps."],
  ];

  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <MarketingNav active="pricing"/>
      <div style={{ padding: '72px 48px 64px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <div className="t-overline" style={{ marginBottom: 12 }}>Pricing</div>
        <div className="t-display-lg" style={{ marginBottom: 14 }}>Start free. Pay when you scale.</div>
        <div className="t-body-lg muted" style={{ maxWidth: 560, margin: '0 auto' }}>
          No credit card to try. No usage spikes. No per-seat pricing on small teams.
        </div>
      </div>

      <div style={{ padding: '0 48px', maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {plans.map(p => (
          <div key={p.name} style={{
            background: p.highlight ? 'var(--surface-1)' : 'var(--surface-0)',
            border: `1px solid ${p.highlight ? 'var(--accent)' : 'var(--hair)'}`,
            borderRadius: 14, padding: 28, position: 'relative',
            boxShadow: p.highlight ? 'var(--shadow-accent)' : 'none',
          }}>
            {p.highlight && <div style={{ position: 'absolute', top: -10, left: 24, padding: '3px 10px', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 4 }}>MOST POPULAR</div>}
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
              <span style={{ fontFamily: 'var(--f-display)', fontSize: 40, fontWeight: 600 }}>{p.price}</span>
              <span className="t-caption">{p.per}</span>
            </div>
            <Button variant={p.variant} full onClick={p.highlight ? () => openModal('upgrade-plan', { direction: 'up', plan: p.name }) : undefined}>{p.cta}</Button>
            <div style={{ height: 1, background: 'var(--hair)', margin: '24px 0' }}/>
            {p.features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 13 }}>
                <Icon name="check" size={14} stroke="var(--success)" strokeWidth={2} style={{ marginTop: 3 }}/>
                <span>{f}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Compare */}
      <div style={{ padding: '72px 48px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <div className="t-title" style={{ marginBottom: 24, textAlign: 'center' }}>Compare plans</div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            <span>Feature</span><span>Free</span><span>Pro</span><span>Studio</span>
          </div>
          {compareRows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: i === compareRows.length - 1 ? 'none' : '1px solid var(--hair)', fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{row[0]}</span>
              {row.slice(1).map((v, j) => (
                <span key={j} style={{ color: v === '—' ? 'var(--text-subtle)' : v === '✓' ? 'var(--success)' : 'var(--text-muted)' }}>{v}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ padding: '40px 48px 64px', maxWidth: 720, margin: '0 auto' }}>
        <div className="t-title" style={{ marginBottom: 24, textAlign: 'center' }}>Pricing FAQ</div>
        {faqs.map(([q, a]) => (
          <div key={q} style={{ padding: '20px 0', borderBottom: '1px solid var(--hair)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{q}</div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{a}</div>
          </div>
        ))}
      </div>

      <MarketingFooter/>
    </div>
  );
};

// ============================================================
// 2.3 Changelog
// ============================================================
const ChangelogScreen = () => {
  const entries = [
    { date: 'April 20, 2026', version: 'v0.14.2', groups: {
      New: ['Templates gallery — 230 starter apps from the community'],
      Improved: ['Builder diff cards now show file-level hunks when expanded', 'Generation speed: 18% faster average across the Haiku pipeline'],
      Fixed: ['Published URLs with trailing slashes were 404-ing in rare cases'],
    }},
    { date: 'April 8, 2026', version: 'v0.14.0', groups: {
      New: ['Theme picker with 5 personas, each a real render of your app', 'Command palette (⌘K) across the whole product'],
      Improved: ['Convex schema preview before you connect — no more blind wiring'],
      Fixed: ['Empty-state illustrations were cropped on the Dashboard'],
    }},
    { date: 'March 24, 2026', version: 'v0.13.4', groups: {
      New: ['Version history with one-click restore'],
      Improved: ['Dashboard now groups apps by Draft / Published'],
      Fixed: ['Avatar uploads larger than 2MB silently failed'],
    }},
    { date: 'March 10, 2026', version: 'v0.13.0', groups: {
      New: ['Custom domains for Pro customers', 'Export to GitHub (opt-in)'],
      Improved: ['Onboarding reduced from 8 steps to 3'],
      Fixed: ['iOS Safari: status bar was overlapping hero on landing'],
    }},
    { date: 'February 28, 2026', version: 'v0.12.1', groups: {
      New: ['Analytics: 30-day bars, top screens, error rates'],
      Improved: ['Builder preview now renders 40% faster on cold load'],
      Fixed: ['Sign-in with Google broke for new Workspace accounts'],
    }},
    { date: 'February 14, 2026', version: 'v0.12.0', groups: {
      New: ['Builder interactive preview — tap any component to edit'],
      Improved: ['New UI components: Toggle, Chip, Toast'],
      Fixed: ['Rate limiting on the generation endpoint was too aggressive for paid plans'],
    }},
  ];

  const kindColor = { New: 'var(--success)', Improved: 'var(--accent)', Fixed: 'var(--warning)' };

  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <MarketingNav active="changelog"/>
      <div style={{ padding: '72px 48px 48px', maxWidth: 780, margin: '0 auto' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>Changelog</div>
        <div className="t-display" style={{ marginBottom: 14 }}>What's new in Appio</div>
        <div className="t-body-lg muted">A running log of what we ship — and what we fix.</div>
      </div>

      <div style={{ padding: '0 48px 80px', maxWidth: 780, margin: '0 auto' }}>
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 32, padding: '32px 0', borderTop: '1px solid var(--hair)' }}>
            <div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{e.date}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--accent)' }}>{e.version}</div>
            </div>
            <div>
              {Object.entries(e.groups).map(([kind, items]) => (
                <div key={kind} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 10 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: kindColor[kind] }}/>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{kind}</span>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {items.map((item, j) => (
                      <li key={j} style={{ padding: '5px 0', fontSize: 14, lineHeight: 1.55, display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--text-subtle)', marginTop: 1, flexShrink: 0 }}>·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <MarketingFooter/>
    </div>
  );
};

// ============================================================
// 2.4 Roadmap
// ============================================================
const RoadmapScreen = () => {
  const cols = [
    { title: 'Shipped', icon: 'check', color: 'var(--success)', items: [
      { t: 'Templates gallery',        d: '230 starter apps, categorized and searchable',          v: 412 },
      { t: 'Command palette (⌘K)',     d: 'Jump to any app, screen, or command from anywhere',     v: 367 },
      { t: 'Theme picker',             d: '5 distinct personas rendered on your real app',         v: 291 },
      { t: 'Version history',          d: 'Every save, one click to restore',                      v: 248 },
      { t: 'Custom domains (Pro)',     d: 'Bring your own domain with auto SSL',                   v: 189 },
    ]},
    { title: 'In progress', icon: 'loader', color: 'var(--accent)', items: [
      { t: 'Theme AI generator',       d: "Describe a feeling, get a theme. No more '5 choices.'", v: 524 },
      { t: 'Collaborative editing',    d: 'Multiple creators in the same Builder in real time',    v: 486 },
      { t: 'Native iOS shell',         d: 'Wrap your Appio app as a real App Store submission',    v: 902 },
      { t: 'Payments (Stripe)',        d: 'Take money from your users without writing checkout',   v: 312 },
    ]},
    { title: 'Exploring', icon: 'sparkle', color: 'var(--warning)', items: [
      { t: 'Advisor (Opus)',           d: "Escalate complex edits to Opus — opt-in, slower, deeper.", v: 178 },
      { t: 'Local-first mode',         d: 'Offline edits sync when you come back',                 v: 134 },
      { t: 'Figma import',             d: 'Start from a Figma file, not a sentence',               v: 268 },
      { t: 'Visual editor overlay',    d: 'Click any element in preview to edit in place',         v: 421 },
      { t: 'Self-host',                d: 'BYO Claude key, BYO infra, BYO everything',             v: 89 },
    ]},
  ];
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <MarketingNav active={null}/>
      <div style={{ padding: '72px 48px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>Roadmap</div>
        <div className="t-display" style={{ marginBottom: 14 }}>Built in public.</div>
        <div className="t-body-lg muted" style={{ maxWidth: 560 }}>What we're working on, what's next, and what we're still thinking about. Vote to nudge priority.</div>
      </div>

      <div style={{ padding: '0 48px 72px', maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {cols.map(col => (
          <div key={col.title}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, marginBottom: 12 }}>
              <Icon name={col.icon} size={16} stroke={col.color}/>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{col.title}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>{col.items.length}</span>
            </div>
            {col.items.map(item => (
              <div key={item.t} style={{ padding: 14, marginBottom: 8, background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.t}</div>
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>{item.d}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 4, width: 'fit-content', fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Icon name="arrowUp" size={11}/>
                  {item.v}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <MarketingFooter/>
    </div>
  );
};

// ============================================================
// 2.5 Placeholder page template
// ============================================================
const PlaceholderPage = ({ title, kicker = 'Coming soon', subtitle }) => (
  <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
    <MarketingNav active={null}/>
    <div style={{ padding: '80px 48px', maxWidth: 720, margin: '0 auto' }}>
      <div className="t-overline" style={{ marginBottom: 12 }}>{kicker}</div>
      <div className="t-display" style={{ marginBottom: 16 }}>{title}</div>
      <div className="t-body-lg muted" style={{ marginBottom: 32 }}>{subtitle || 'This page is a stub. Final copy is coming before launch.'}</div>
      <div style={{ background: 'var(--surface-1)', border: '1px dashed var(--strong)', borderRadius: 12, padding: 32, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, fontFamily: 'var(--f-mono)' }}>
        {/* stubbed content */}
        [ Lorem ipsum content area — real copy pending editorial review ]<br/><br/>
        This placeholder preserves the page shell, nav, and footer so internal links stay meaningful during review. When the content writer delivers, we'll slot it in without any structural changes.
      </div>
    </div>
    <MarketingFooter/>
  </div>
);

const AboutPage     = () => <PlaceholderPage title="About Appio"       subtitle="We think software should be writable by anyone who can describe what they want."/>;
const BlogPage      = () => <PlaceholderPage title="From the studio"   kicker="Blog" subtitle="Writing on craft, Claude, and the weird state of software in 2026."/>;
const PrivacyPage   = () => <PlaceholderPage title="Privacy policy"    kicker="Legal" subtitle="Last updated April 3, 2026."/>;
const TermsPage     = () => <PlaceholderPage title="Terms of service"  kicker="Legal" subtitle="Last updated April 3, 2026."/>;
const DocsPage      = () => <PlaceholderPage title="Documentation"     kicker="Docs"  subtitle="Guides, API reference, and deep-dive essays on shipping with Appio."/>;
const CommunityPage = () => <PlaceholderPage title="Community"         subtitle="The Appio Discord, Showcase of the Week, and our public roadmap."/>;
const SupportPage   = () => <PlaceholderPage title="Support"           subtitle="Email, a searchable FAQ, and the humans behind Appio."/>;

// ============================================================
// 2.6 Account sub-pages
// ============================================================
const AccountShell = ({ activeTab, children }) => {
  const { navigate } = useApp();
  const tabs = [
    ['profile',      'Profile',            'user'],
    ['connected',    'Connected services', 'link'],
    ['notifications','Notifications',      'bell'],
    ['security',     'Security',           'lock'],
  ];
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <TopNav active="Account"/>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 48px' }}>
        <div className="t-display" style={{ marginBottom: 8 }}>Account</div>
        <div className="t-body-lg muted" style={{ marginBottom: 32 }}>Manage your identity, integrations, and security settings.</div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 40 }}>
          <nav>
            {tabs.map(([id, label, icon]) => (
              <div key={id} onClick={() => navigate(id === 'profile' ? 'account' : `account-${id}`)} style={{
                padding: '9px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                background: activeTab === id ? 'var(--surface-2)' : 'transparent',
                color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === id ? 500 : 400,
              }}>
                <Icon name={icon} size={14}/>
                {label}
              </div>
            ))}
          </nav>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};

const AccountConnectedPage = () => {
  const { toast } = useApp();
  const services = [
    { icon: 'convex', name: 'Convex',   meta: 'clara@craftletters.co', connected: true,  desc: 'Real-time database for your apps' },
    { icon: 'github', name: 'GitHub',   meta: 'github.com/claraj',     connected: true,  desc: 'Export apps as Git repositories' },
    { icon: 'google', name: 'Google',   meta: 'Sign-in provider',      connected: true,  desc: 'Use Google to sign in' },
    { icon: 'chat',   name: 'Slack',    meta: null,                    connected: false, desc: 'Get build notifications in Slack' },
    { icon: 'panel',  name: 'Linear',   meta: null,                    connected: false, desc: 'Sync feedback to Linear issues' },
    { icon: 'lock',   name: 'Stripe',   meta: null,                    connected: false, desc: 'Accept payments in your apps' },
  ];
  return (
    <AccountShell activeTab="connected">
      <Card padding={0}>
        {services.map((s, i) => (
          <div key={s.name} style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: i === services.length - 1 ? 'none' : '1px solid var(--hair)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={s.icon} size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                {s.connected && <Chip variant="ready" size="sm">Connected</Chip>}
              </div>
              <div className="t-caption">{s.meta || s.desc}</div>
            </div>
            {s.connected ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => window.open('#', '_blank')}>Manage</Button>
                <Button variant="ghost" size="sm" onClick={() => toast(`${s.name} disconnected`, { variant: 'warning' })}>Disconnect</Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => toast(`Connecting ${s.name}…`)}>Connect</Button>
            )}
          </div>
        ))}
      </Card>
    </AccountShell>
  );
};

const AccountNotificationsPage = () => {
  const [toggles, setToggles] = React.useState({
    emailBuilds: true, emailFailures: true, emailDigest: false,
    inAppBuilds: true, inAppFailures: true, inAppDigest: true,
    dnd: true,
  });
  const toggle = (k) => setToggles(t => ({ ...t, [k]: !t[k] }));
  const Row = ({ label, sub, k }) => (
    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--hair)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div className="t-caption" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={toggles[k]} onChange={() => toggle(k)}/>
    </div>
  );
  return (
    <AccountShell activeTab="notifications">
      <div className="t-overline" style={{ marginBottom: 10 }}>Email</div>
      <Card padding={0} style={{ marginBottom: 24 }}>
        <Row label="Build completions"  sub="Every time your app finishes generating"   k="emailBuilds"/>
        <Row label="Build failures"     sub="Only when something goes wrong"             k="emailFailures"/>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Weekly digest</div>
            <div className="t-caption" style={{ marginTop: 2 }}>Sunday morning: your stats, top errors, what others remixed</div>
          </div>
          <Toggle on={toggles.emailDigest} onChange={() => toggle('emailDigest')}/>
        </div>
      </Card>

      <div className="t-overline" style={{ marginBottom: 10 }}>In-app</div>
      <Card padding={0} style={{ marginBottom: 24 }}>
        <Row label="Build completions" sub="Toast in the top-right"  k="inAppBuilds"/>
        <Row label="Build failures"    sub="Red banner over Builder" k="inAppFailures"/>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Weekly digest</div>
            <div className="t-caption" style={{ marginTop: 2 }}>Appears in the Dashboard</div>
          </div>
          <Toggle on={toggles.inAppDigest} onChange={() => toggle('inAppDigest')}/>
        </div>
      </Card>

      <div className="t-overline" style={{ marginBottom: 10 }}>Preferences</div>
      <Card padding={0}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Do not disturb</div>
            <div className="t-caption" style={{ marginTop: 2 }}>Mute all notifications 10 PM – 8 AM local time</div>
          </div>
          <Toggle on={toggles.dnd} onChange={() => toggle('dnd')}/>
        </div>
      </Card>
    </AccountShell>
  );
};

const AccountSecurityPage = () => {
  const { toast } = useApp();
  const [twofa, setTwofa] = React.useState(false);
  const sessions = [
    { device: 'MacBook Pro · Safari',   loc: 'San Francisco, CA', last: 'Active now',       cur: true },
    { device: 'iPhone 15 Pro · Safari', loc: 'San Francisco, CA', last: '14 min ago',       cur: false },
    { device: 'iPad Air · Chrome',      loc: 'Oakland, CA',       last: 'Yesterday, 9:12 PM', cur: false },
    { device: 'Chrome · Linux',         loc: 'Berlin, DE',        last: 'April 6',          cur: false },
  ];
  return (
    <AccountShell activeTab="security">
      <div className="t-overline" style={{ marginBottom: 10 }}>Two-factor authentication</div>
      <Card padding={20} style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{twofa ? '2FA enabled' : 'Add an extra layer'}</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
              {twofa ? "You'll be asked for a 6-digit code from your authenticator app on every new device." : 'Use an authenticator app (1Password, Authy, or Google Authenticator) for sign-in.'}
            </div>
            {twofa ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => toast('Backup codes copied', { variant: 'success' })}>Copy backup codes</Button>
                <Button variant="ghost" size="sm" onClick={() => setTwofa(false)}>Disable</Button>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setTwofa(true)}>Set up 2FA</Button>
            )}
          </div>
          <div style={{ width: 120, height: 120, background: '#fff', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: twofa ? 0.3 : 1 }}>
            <QRCodeFaux/>
          </div>
        </div>
      </Card>

      <div className="t-overline" style={{ marginBottom: 10 }}>Active sessions</div>
      <Card padding={0}>
        {sessions.map((s, i) => (
          <div key={i} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i === sessions.length - 1 ? 'none' : '1px solid var(--hair)' }}>
            <Icon name={s.device.includes('iPhone') || s.device.includes('iPad') ? 'phone' : 'device'} size={16} stroke="var(--text-muted)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.device} {s.cur && <span className="t-mono-sm" style={{ color: 'var(--success)', marginLeft: 6 }}>· this device</span>}</div>
              <div className="t-caption">{s.loc} · {s.last}</div>
            </div>
            {!s.cur && <Button variant="ghost" size="sm" onClick={() => toast('Session ended', { variant: 'warning' })}>End</Button>}
          </div>
        ))}
      </Card>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => toast('Signed out of all devices', { variant: 'warning' })}>Sign out of all devices</Button>
      </div>
    </AccountShell>
  );
};

Object.assign(window, {
  MarketingNav, MarketingFooter, PlaceholderPage,
  TemplatesScreen, PricingScreen, ChangelogScreen, RoadmapScreen,
  AboutPage, BlogPage, PrivacyPage, TermsPage, DocsPage, CommunityPage, SupportPage,
  AccountShell, AccountConnectedPage, AccountNotificationsPage, AccountSecurityPage,
});
