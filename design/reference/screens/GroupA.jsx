// Group A — Landing, Auth, Onboarding

const LandingScreen = () => {
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      {/* Nav */}
      <div style={{ padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMark size={22} />
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Appio</span>
        </div>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <a className="t-caption" style={{ cursor: 'pointer' }}>Showcase</a>
          <a className="t-caption" style={{ cursor: 'pointer' }}>Pricing</a>
          <a className="t-caption" style={{ cursor: 'pointer' }}>Changelog</a>
          <Button variant="secondary" size="sm">Sign in</Button>
          <Button variant="primary" size="sm">Start free</Button>
        </div>
      </div>

      {/* Hero */}
      <section style={{ padding: '96px 48px 64px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '5px 10px', border: '1px solid var(--hair)', borderRadius: 999, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)', marginBottom: 32 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}/>
              Sprint 2 · open beta
            </span>
            <h1 className="t-display-xl" style={{ margin: 0, maxWidth: 640 }}>
              Build your app<br/>
              by talking<br/>
              <span style={{ color: 'var(--accent)' }}>to it.</span>
            </h1>
            <p className="t-body-lg muted" style={{ maxWidth: 460, marginTop: 24 }}>
              Appio turns a sentence into a real React PWA — installable, your data, no developer handholding. For the hobbyists, makers, and small-business owners who have the idea and are tired of waiting.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 32, alignItems: 'center' }}>
              <Button variant="primary" size="lg" trailingIcon="arrowRight">Start building free</Button>
              <Button variant="ghost" size="lg">Watch a 40s demo</Button>
            </div>
            <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--f-mono)' }}>
              No credit card · Own your code · Export anytime
            </div>
          </div>

          {/* Live demo card */}
          <LandingDemoCard/>
        </div>
      </section>

      {/* Value props */}
      <section style={{ padding: '48px 48px 96px', maxWidth: 1280, margin: '0 auto', borderTop: '1px solid var(--hair)', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
          {[
            { n: '01', title: 'Talk, don\'t prompt.', body: 'Say what you want in plain language. Appio writes real React, asks follow-ups when it has to, and never lectures you on prompt engineering.' },
            { n: '02', title: 'Installable from day one.', body: 'Every build is a PWA. Your users add it to their home screen and it feels native — offline, push, the works.' },
            { n: '03', title: 'Your data, your stack.', body: 'Data lives in your Convex. Code exports as React. If Appio shuts down tomorrow, your app keeps running.' },
          ].map(v => (
            <div key={v.n}>
              <div className="t-mono-sm" style={{ color: 'var(--accent)', marginBottom: 16 }}>{v.n}</div>
              <div className="t-title" style={{ marginBottom: 12 }}>{v.title}</div>
              <div className="t-body muted">{v.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase */}
      <section style={{ padding: '96px 48px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48 }}>
          <div>
            <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 8 }}>Showcase</div>
            <div className="t-display">Apps shipped in an afternoon.</div>
          </div>
          <a className="t-caption" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>See all 230 <Icon name="arrowRight" size={12}/></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {SHOWCASE.map((s, i) => <ShowcaseCard key={s.app} {...s} accent={i === 1}/>)}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '48px 48px 96px', maxWidth: 900, margin: '0 auto' }}>
        <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 8 }}>Questions</div>
        <div className="t-display" style={{ marginBottom: 48 }}>Fair things to ask.</div>
        {[
          { q: 'Do I need to know how to code?', a: 'No. If you can describe what the app should do, Appio can build it. Technical view is there if you want it, hidden if you don\'t.' },
          { q: 'Who owns the code?', a: 'You do. Export as a GitHub repo anytime. We don\'t hold your work hostage.' },
          { q: 'Why do I connect my own Convex account?', a: 'Because your users\' data should live in your database, not ours. It\'s two clicks and it means you keep control, forever.' },
          { q: 'What happens when I want a real developer to take over?', a: 'They open the exported repo in Cursor or VS Code. It\'s just React + Convex — no lock-in, no weird DSL.' },
          { q: 'Is it really fast enough for non-developers?', a: 'Creators in our beta shipped their first app in under 3 hours on average. Several did it in one.' },
        ].map((f, i) => (
          <FAQItem key={i} q={f.q} a={f.a} defaultOpen={i === 0}/>
        ))}
      </section>

      {/* Footer */}
      <footer style={{ padding: '48px', borderTop: '1px solid var(--hair)', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <LogoMark size={20} /><span style={{ fontFamily: 'var(--f-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Appio</span>
            </div>
            <div className="t-caption" style={{ maxWidth: 320 }}>Build your app by talking to it.</div>
          </div>
          {[
            ['Product', ['Showcase','Pricing','Changelog','Roadmap']],
            ['Creator', ['Docs','Templates','Community','Support']],
            ['Company', ['About','Blog','Privacy','Terms']],
          ].map(([h, links]) => (
            <div key={h}>
              <div className="t-overline" style={{ marginBottom: 12, color: 'var(--text-primary)' }}>{h}</div>
              {links.map(l => <div key={l} className="t-caption" style={{ marginBottom: 6, cursor: 'pointer' }}>{l}</div>)}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1280, margin: '48px auto 0', paddingTop: 24, borderTop: '1px solid var(--hair)', fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between' }}>
          <span>© 2026 Appio. Built by a solo dev in public.</span>
          <span>v0.4.1-beta</span>
        </div>
      </footer>
    </div>
  );
};

const LogoMark = ({ size = 22 }) => (
  <div style={{ width: size, height: size, borderRadius: size/4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.6, fontFamily: 'var(--f-display)', fontWeight: 700, letterSpacing: '-0.03em' }}>
    A
  </div>
);

const LandingDemoCard = () => (
  <div style={{
    background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 16, padding: 20,
    boxShadow: 'var(--shadow-card)', position: 'relative',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Chip variant="writing">Assistant is writing</Chip>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--f-mono)' }}>00:14</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
      <div>
        <UserMessage>make the habit cards more playful</UserMessage>
        <AssistantMessage>
          Softened the corners, bumped the icons, added a little rotation per card. Streak count still primary.
        </AssistantMessage>
        <DiffCard kind="changed" title="Updated: Home screen" files="3 files · HabitCard, theme.ts" animate/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IPhoneFrame width={180}>
          <StreakApp screen="home" theme="default" playful scale={180/393}/>
        </IPhoneFrame>
      </div>
    </div>
  </div>
);

const SHOWCASE = [
  { app: 'Morning Pages', creator: 'Clara', role: 'Writer',        quote: '"It felt less like coding and more like dictating a letter."', time: 'Built in 2 hours', kind: 'journal' },
  { app: 'devonlin.app',  creator: 'Dev',   role: 'Link-in-bio',   quote: '"I replaced three tools I was paying for."',                   time: 'Built in 45 minutes', kind: 'bio' },
  { app: 'Iron Week',     creator: 'Marco', role: 'Powerlifter',   quote: '"My coach uses it. My lifts use it. Great app, stupid name."', time: 'Built in 4 hours', kind: 'workout' },
  { app: 'Pan & Co',      creator: 'Sofia', role: 'Bakery owner',  quote: '"Daily menu updates used to take an hour. Now it\'s a sentence."', time: 'Built in 1 hour', kind: 'bakery' },
];

const ShowcaseCard = ({ app, creator, role, quote, time, kind, accent }) => (
  <div style={{
    background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 14,
    overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
  }}>
    {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent)' }}/>}
    <div style={{
      aspectRatio: '4/5', background: 'var(--surface-2)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      borderBottom: '1px solid var(--hair)', padding: '24px 0 0',
    }}>
      <div style={{ transform: 'translateY(12%)' }}>
        <IPhoneFrame width={150}>
          <MiniApp kind={kind} scale={150/393}/>
        </IPhoneFrame>
      </div>
    </div>
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{creator[0]}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{creator}</div>
          <div className="t-caption">{role} · {app}</div>
        </div>
      </div>
      <div className="t-body muted" style={{ fontStyle: 'italic', minHeight: 60 }}>{quote}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--hair)' }}>
        <span className="t-mono-sm" style={{ color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>{time}</span>
        <Icon name="arrowRight" size={14} stroke="var(--text-muted)"/>
      </div>
    </div>
  </div>
);

// Distinct mini-app previews for showcase — each reinforces a different theme persona
const MiniApp = ({ kind, scale = 1 }) => {
  const inner = { width: 393, height: 852, transform: `scale(${scale})`, transformOrigin: 'top left' };
  const wrap = { width: 393 * scale, height: 852 * scale, overflow: 'hidden', position: 'relative' };
  return <div style={wrap}><div style={inner}>{renderMini(kind)}</div></div>;
};

const renderMini = (kind) => {
  if (kind === 'journal') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#F5EFE4', color: '#2A2418', padding: '70px 36px 0', fontFamily: "'Fraunces', Georgia, serif" }}>
        <div style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8A7355', marginBottom: 24 }}>Morning Pages</div>
        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 4 }}>Wednesday,</div>
        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.05, fontStyle: 'italic', marginBottom: 40 }}>April 23</div>
        <div style={{ fontSize: 18, lineHeight: 1.7, color: '#4A3E28' }}>
          Woke before the light. The kitchen is colder than it should be for April. Three pages today — no fewer.
        </div>
        <div style={{ position: 'absolute', bottom: 120, left: 36, right: 36, fontSize: 12, color: '#8A7355', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>01 / 03 PAGES</div>
      </div>
    );
  }
  if (kind === 'bio') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0E1712', color: '#E8F5EC', padding: '70px 30px 0', fontFamily: "'General Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #6EE7B7, #10B981)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E1712', fontSize: 36, fontWeight: 700 }}>D</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>@devonlin</div>
          <div style={{ fontSize: 14, color: '#6EE7B7', marginTop: 4 }}>designer · photos · occasional thoughts</div>
        </div>
        {['Portfolio','Newsletter','Photography','Podcast','Store'].map((l, i) => (
          <div key={l} style={{ background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, fontSize: 15, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{l}</span>
            <span style={{ color: '#6EE7B7' }}>↗</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'workout') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0A0A0A', color: '#fff', padding: '70px 28px 0', fontFamily: "'General Sans', sans-serif" }}>
        <div style={{ fontSize: 11, letterSpacing: '0.25em', color: '#FB923C', marginBottom: 8, fontWeight: 700 }}>IRON WEEK</div>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 4 }}>WEEK 14</div>
        <div style={{ fontSize: 16, color: '#8A8A8A', marginBottom: 36 }}>4 of 5 sessions · 1 to go</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 32 }}>
          {['M','T','W','T','F','S','S'].map((d, i) => {
            const done = [0,1,2,4].includes(i);
            const today = i === 3;
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6A6A6A', marginBottom: 6 }}>{d}</div>
                <div style={{ aspectRatio: '1/1', background: done ? '#FB923C' : today ? 'transparent' : '#1A1A1A', border: today ? '2px solid #FB923C' : 'none', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A0A0A', fontWeight: 700, fontSize: 16 }}>
                  {done ? '✓' : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid #1A1A1A', paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: '#6A6A6A', marginBottom: 4 }}>SQUAT PR</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>185<span style={{ fontSize: 16, color: '#FB923C', marginLeft: 6 }}>kg</span></div>
        </div>
      </div>
    );
  }
  if (kind === 'bakery') {
    return (
      <div style={{ width: '100%', height: '100%', background: '#F2EADB', color: '#3E2B1C', fontFamily: "'Fraunces', Georgia, serif" }}>
        <div style={{ height: 260, background: 'linear-gradient(180deg, #C98B5A, #9A5A2E)', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 24 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.3, background: 'repeating-radial-gradient(circle at 30% 40%, #8A4A20 0 3px, transparent 3px 12px)' }}/>
          <div style={{ color: '#F2EADB', fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', fontFamily: "'General Sans', sans-serif", fontWeight: 600, zIndex: 1 }}>Today's menu</div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 32, fontWeight: 600, fontStyle: 'italic', letterSpacing: '-0.01em', marginBottom: 2 }}>Pan &amp; Co</div>
          <div style={{ fontSize: 12, color: '#8A6A45', fontFamily: "'General Sans', sans-serif", marginBottom: 20, letterSpacing: '0.05em' }}>APR 23 · WED · OPEN UNTIL 18:00</div>
          {[
            { n: 'Country Sourdough', d: '24h ferment · rye starter', p: '€8' },
            { n: 'Butter Croissant', d: 'French butter · 3-day laminate', p: '€3.20' },
            { n: 'Cardamom Bun', d: 'Swedish-style · hand-knotted', p: '€4' },
          ].map(i => (
            <div key={i.n} style={{ padding: '14px 0', borderBottom: '1px solid #D8CAB0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{i.n}</div>
                <div style={{ fontSize: 12, color: '#8A6A45', fontFamily: "'General Sans', sans-serif", marginTop: 2 }}>{i.d}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{i.p}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const FAQItem = ({ q, a, defaultOpen }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div onClick={() => setOpen(!open)} style={{ padding: '20px 0', borderBottom: '1px solid var(--hair)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="t-h3">{q}</div>
        <Icon name={open ? 'minus' : 'plus'} size={18} stroke="var(--text-muted)" />
      </div>
      {open && <div className="t-body-lg muted" style={{ marginTop: 12, maxWidth: 720 }}>{a}</div>}
    </div>
  );
};

// ---------- Auth ----------
const AuthScreen = ({ mode: initialMode = 'signin' }) => {
  const [mode, setMode] = React.useState(initialMode);
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--surface-0)' }}>
      <div style={{ padding: 48, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMark size={22}/>
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>Appio</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div className="t-title" style={{ marginBottom: 32 }}>{mode === 'signin' ? 'Welcome back.' : 'Start building.'}</div>

            <Button variant="secondary" size="lg" full icon="google">Continue with Google</Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: 'var(--text-subtle)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--hair)' }}/>OR<div style={{ flex: 1, height: 1, background: 'var(--hair)' }}/>
            </div>
            <div className="t-caption" style={{ marginBottom: 6 }}>Email</div>
            <Input placeholder="you@example.com" style={{ marginBottom: 16 }}/>
            {mode === 'signup' && <>
              <div className="t-caption" style={{ marginBottom: 6 }}>Your name</div>
              <Input placeholder="Clara" style={{ marginBottom: 16 }}/>
            </>}
            <div className="t-caption" style={{ marginBottom: 6 }}>Password</div>
            <Input type="password" placeholder="••••••••" style={{ marginBottom: 24 }}/>
            <Button variant="primary" size="lg" full>{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13 }}>
              <span className="muted">{mode === 'signin' ? 'New here? ' : 'Already have an account? '}</span>
              <a onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </a>
            </div>
          </div>
        </div>
        <div className="t-caption">© Appio 2026 · Privacy · Terms</div>
      </div>

      <div style={{
        background: 'radial-gradient(circle at 30% 20%, rgba(124,92,255,0.18), transparent 60%), var(--surface-1)',
        borderLeft: '1px solid var(--hair)',
        padding: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ textAlign: 'center' }}>
          <IPhoneFrame width={260}><StreakApp screen="home" theme="default" scale={260/393}/></IPhoneFrame>
          <div className="t-h3" style={{ marginTop: 32, maxWidth: 380 }}>
            "It felt less like coding and more like dictating a letter."
          </div>
          <div className="t-caption" style={{ marginTop: 12 }}>Clara, writer — shipped in 2 hours</div>
        </div>
      </div>
    </div>
  );
};

// ---------- Onboarding ----------
const OnboardingScreen = ({ initialStep = 0 }) => {
  const [step, setStep] = React.useState(initialStep);
  const steps = [
    {
      over: 'Welcome',
      title: 'Hello, creator.',
      body: 'Appio builds real apps from the things you say. No drag-and-drop. No boilerplate. No "configure your sandbox".',
      visual: <OnbVisual1/>,
    },
    {
      over: 'How it works',
      title: 'Describe. Review. Ship.',
      body: 'Talk to the assistant, watch the app take shape inside an iPhone preview, and publish when you like what you see.',
      visual: <OnbVisual2/>,
    },
    {
      over: 'Over to you',
      title: 'What do you want to build?',
      body: null,
      visual: <OnbVisual3/>,
    },
  ];
  const s = steps[step];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)', padding: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoMark size={22}/>
        <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>Appio</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 4, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--surface-2)', transition: 'all var(--t-base) var(--ease-out)' }}/>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 12 }}>{s.over}</div>
          <div className="t-display-lg" style={{ marginBottom: 16 }}>{s.title}</div>
          {s.body && <div className="t-body-lg muted" style={{ maxWidth: 480 }}>{s.body}</div>}
          {step === 2 && <OnbPromptBox/>}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {step > 0 && <Button variant="ghost" icon="chevronLeft" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 2 && <Button variant="primary" trailingIcon="arrowRight" onClick={() => setStep(step + 1)}>Continue</Button>}
            {step === 2 && <Button variant="primary" trailingIcon="sparkle">Create my app</Button>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{s.visual}</div>
      </div>
    </div>
  );
};

const OnbVisual1 = () => (
  <div style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', inset: -40, background: 'radial-gradient(circle, var(--glow), transparent 60%)', zIndex: 0 }}/>
    <div style={{ position: 'relative', display: 'flex', gap: 12 }}>
      <IPhoneFrame width={220}><StreakApp screen="home" theme="default" scale={220/393}/></IPhoneFrame>
    </div>
  </div>
);

const OnbVisual2 = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 420 }}>
    {[
      { n: 1, label: 'Describe', body: '"A simple habit tracker with streak counts."' },
      { n: 2, label: 'Review', body: 'Watch screens appear in the live preview.' },
      { n: 3, label: 'Ship', body: 'Publish to a real URL, install as PWA.' },
    ].map(s => (
      <div key={s.n} style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontFamily: 'var(--f-mono)' }}>{s.n}</div>
        <div>
          <div className="t-h4">{s.label}</div>
          <div className="t-caption">{s.body}</div>
        </div>
      </div>
    ))}
  </div>
);

const OnbPromptBox = () => {
  const [val, setVal] = React.useState('A quiet habit tracker for morning routines');
  return (
    <div style={{ marginTop: 32, background: 'var(--surface-1)', border: '1px solid var(--strong)', borderRadius: 14, padding: 16, maxWidth: 560, boxShadow: 'var(--shadow-accent)' }}>
      <textarea value={val} onChange={e => setVal(e.target.value)} rows={3} style={{
        width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)',
        fontFamily: 'var(--f-display)', fontSize: 22, letterSpacing: '-0.01em', resize: 'none',
      }}/>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {['Habit tracker','Recipe box','Workout log','Journal','Link-in-bio','Event RSVP'].map(t => (
          <span key={t} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--hair)', borderRadius: 999, color: 'var(--text-muted)', cursor: 'pointer' }}>{t}</span>
        ))}
      </div>
    </div>
  );
};

const OnbVisual3 = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, transform: 'rotate(-3deg)' }}>
    {['"A gratitude journal."','"A wedding RSVP app."','"A workout tracker my coach can see."','"A link-in-bio for my gallery."'].map((t, i) => (
      <div key={i} style={{
        alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
        padding: '12px 18px',
        background: i === 2 ? 'var(--accent)' : 'var(--surface-2)',
        color: i === 2 ? '#fff' : 'var(--text-primary)',
        border: '1px solid var(--hair)',
        borderRadius: 14, borderBottomRightRadius: i % 2 === 0 ? 14 : 4, borderBottomLeftRadius: i % 2 === 0 ? 4 : 14,
        fontSize: 15, maxWidth: 280,
      }}>{t}</div>
    ))}
  </div>
);

const SignInScreen = () => <AuthScreen mode="signin"/>;
const SignUpScreen = () => <AuthScreen mode="signup"/>;
const OnboardingWelcomeScreen = () => <OnboardingScreen initialStep={0}/>;
const OnboardingFirstAppScreen = () => <OnboardingScreen initialStep={2}/>;

Object.assign(window, { LandingScreen, AuthScreen, SignInScreen, SignUpScreen, OnboardingScreen, OnboardingWelcomeScreen, OnboardingFirstAppScreen, LogoMark });
