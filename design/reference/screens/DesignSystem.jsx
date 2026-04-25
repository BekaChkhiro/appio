// Design System frame — Part 1 of the deliverable
const DesignSystemFrame = () => {
  const [showExpanded, setShowExpanded] = React.useState(false);
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', padding: '64px 80px 120px', background: 'var(--surface-0)' }}>
      {/* Masthead */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 64, alignItems: 'end' }}>
        <div>
          <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 24 }}>Design System — v0.1</div>
          <div className="t-display-xl">Appio.</div>
          <div className="t-display-lg muted" style={{ marginTop: 4, maxWidth: 560 }}>Build your app<br/>by talking to it.</div>
        </div>
        <div>
          <div className="t-caption" style={{ marginBottom: 8 }}>Personality</div>
          <div className="t-body-lg" style={{ color: 'var(--text-primary)', maxWidth: 380 }}>
            Confident, editorial, quietly powerful. The creator — not the prompt engineer — is the protagonist. Typography does the heavy lifting; decoration does not.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            {['Editorial','Dark-first','One accent','No rainbow AI','Fast (≤250ms)'].map(t => (
              <span key={t} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--hair)', borderRadius: 999, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <DSSection num="01" title="Color" desc="OKLCH-authored, sRGB fallback. Violet is the only accent; warm amber used sparingly for rhythm.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}>
          <DSSwatchGroup label="Dark (default)" swatches={[
            { name: 'surface/0', hex: '#0B0B0F', role: 'Deepest background' },
            { name: 'surface/1', hex: '#141418', role: 'Cards, panels' },
            { name: 'surface/2', hex: '#1E1E24', role: 'Hover, raised' },
            { name: 'text/primary', hex: '#F5F3EE', role: 'Primary text — warm off-white' },
            { name: 'text/muted',   hex: '#8A8794', role: 'Secondary text' },
            { name: 'text/subtle',  hex: '#5A5865', role: 'Tertiary text' },
            { name: 'accent/primary', hex: '#7C5CFF', role: 'The only accent. Sparingly.' },
            { name: 'accent/soft', hex: '#2A2140', role: 'Violet-tinted active state' },
          ]}/>
          <DSSwatchGroup label="Light (secondary)" light swatches={[
            { name: 'surface/0', hex: '#F7F5F0', role: 'Deepest background' },
            { name: 'surface/1', hex: '#FFFFFF', role: 'Cards, panels' },
            { name: 'surface/2', hex: '#F0EDE5', role: 'Hover, raised' },
            { name: 'text/primary', hex: '#0B0B0F', role: 'Primary text' },
            { name: 'text/muted',   hex: '#5A5865', role: 'Secondary text' },
            { name: 'text/subtle',  hex: '#8A8794', role: 'Tertiary text' },
            { name: 'accent/primary', hex: '#5D3DFF', role: 'Accent shifted darker for contrast' },
            { name: 'accent/soft', hex: '#ECE6FF', role: 'Violet-tinted active state' },
          ]}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 32 }}>
          {[
            { name: 'success', hex: '#4ADE80' },
            { name: 'warning / rhythm', hex: '#F5A524' },
            { name: 'danger', hex: '#F43F5E' },
            { name: 'border/hair', hex: 'rgba(255,255,255,0.06)', demo: true },
            { name: 'border/strong', hex: 'rgba(255,255,255,0.12)', demo: true },
          ].map(c => (
            <div key={c.name} style={{ border: '1px solid var(--hair)', borderRadius: 10, padding: 12 }}>
              <div style={{ height: 40, borderRadius: 6, background: c.demo ? 'var(--surface-2)' : c.hex, border: c.demo ? `1px solid ${c.hex}` : 'none', marginBottom: 10 }}/>
              <div className="t-mono-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
              <div className="t-mono-sm muted">{c.hex}</div>
            </div>
          ))}
        </div>
      </DSSection>

      <DSSection num="02" title="Typography" desc="General Sans for display & UI, JetBrains Mono for code. No generic defaults.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 48 }}>
          <div>
            {[
              { name: 'Display XL', className: 't-display-xl', spec: 'General Sans · 64 / 65 · -0.03em · 600' , sample: 'Ship the app you pictured.' },
              { name: 'Display',    className: 't-display-lg', spec: 'General Sans · 48 / 50 · -0.025em · 600', sample: 'A creator, not a coder.' },
              { name: 'Title',      className: 't-title',      spec: 'General Sans · 28 / 34 · -0.015em · 600', sample: 'Added the settings screen.' },
              { name: 'Heading 3',  className: 't-h3',         spec: 'General Sans · 20 / 26 · -0.01em · 600',  sample: 'Today' },
              { name: 'Body Large', className: 't-body-lg',    spec: 'General Sans · 16 / 25 · 0 · 400',        sample: 'Describe your idea. Appio does the rest.' },
              { name: 'Body',       className: 't-body',       spec: 'General Sans · 14 / 22 · 0 · 400',        sample: 'Your app auto-saves after every change.' },
              { name: 'Caption',    className: 't-caption',    spec: 'General Sans · 12 / 17 · 0 · 500',        sample: 'Last edited 3 minutes ago' },
              { name: 'Overline',   className: 't-overline',   spec: 'General Sans · 11 / 11 · 0.08em · 600',   sample: 'RECENTLY PUBLISHED' },
              { name: 'Mono',       className: 't-mono',       spec: 'JetBrains Mono · 13 · 400',               sample: 'const habit = { streak: 24 }' },
            ].map(t => (
              <div key={t.name} style={{ padding: '20px 0', borderBottom: '1px solid var(--hair)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="t-mono-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                  <span className="t-mono-sm muted">{t.spec}</span>
                </div>
                <div className={t.className}>{t.sample}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="t-caption" style={{ marginBottom: 12 }}>Character set</div>
            <div style={{ border: '1px solid var(--hair)', borderRadius: 10, padding: 24 }}>
              <div className="t-display" style={{ lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                ABCDEFGHIJKLM<br/>NOPQRSTUVWXYZ
              </div>
              <div className="t-body-lg" style={{ marginTop: 16, color: 'var(--text-muted)' }}>
                abcdefghijklmnop<br/>qrstuvwxyz
              </div>
              <div className="t-mono" style={{ marginTop: 16 }}>
                0123456789 ·<br/>!@#$%&*()–→↗︎
              </div>
            </div>
          </div>
        </div>
      </DSSection>

      <DSSection num="03" title="Space & Radius" desc="4px base scale. Four radii; that's all.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <div className="t-caption" style={{ marginBottom: 16 }}>Spacing</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { n: '1', px: 4 }, { n: '2', px: 8 }, { n: '3', px: 12 },
                { n: '4', px: 16 }, { n: '5', px: 24 }, { n: '6', px: 32 },
                { n: '7', px: 48 }, { n: '8', px: 64 },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className="t-mono-sm muted" style={{ width: 40 }}>s-{s.n}</span>
                  <span className="t-mono-sm muted" style={{ width: 50 }}>{s.px}px</span>
                  <div style={{ height: 6, width: s.px * 3, background: 'var(--accent)', borderRadius: 3, opacity: 0.6 }}/>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="t-caption" style={{ marginBottom: 16 }}>Radius</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { n: 'input', px: 6 },
                { n: 'card',  px: 10 },
                { n: 'modal', px: 14 },
                { n: 'pill',  px: 999 },
              ].map(r => (
                <div key={r.n} style={{ textAlign: 'center' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: 'var(--surface-2)', borderRadius: r.px, border: '1px solid var(--hair)', marginBottom: 10 }}/>
                  <div className="t-mono-sm" style={{ color: 'var(--text-primary)' }}>{r.n}</div>
                  <div className="t-mono-sm muted">{r.px === 999 ? 'full' : `${r.px}px`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DSSection>

      <DSSection num="04" title="Buttons" desc="Primary, secondary, ghost, destructive · 3 sizes · loading · disabled.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
          {['primary','secondary','ghost','destructive'].map(v => (
            <div key={v}>
              <div className="t-overline" style={{ marginBottom: 16 }}>{v}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                <Button variant={v} size="lg">Start building</Button>
                <Button variant={v} size="md">Continue</Button>
                <Button variant={v} size="sm">Edit</Button>
                <Button variant={v} size="md" loading>Publishing</Button>
                <Button variant={v} size="md" disabled>Disabled</Button>
              </div>
            </div>
          ))}
        </div>
      </DSSection>

      <DSSection num="05" title="Inputs" desc="Small set: text, search, toggle, checkbox. Everything else is composition.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input placeholder="App name"/>
            <Input icon="search" placeholder="Search projects…"/>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 6, padding: 12, minHeight: 80, color: 'var(--text-muted)' }}>
              Describe your idea in one sentence…
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Toggle on={true} onChange={() => {}} />
              <span className="t-body muted">Auto-save after every change</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Toggle on={false} onChange={() => {}} />
              <span className="t-body muted">Enable technical view</span>
            </div>
            <Checkbox checked={true}  onChange={() => {}} label="I understand data lives in my Convex"/>
            <Checkbox checked={false} onChange={() => {}} label="Send me a build digest"/>
          </div>
        </div>
      </DSSection>

      <DSSection num="06" title="Chat primitives" desc="User message is a surface/2 bubble. Assistant is plain text — the reply is the UI.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div style={{ background: 'var(--surface-0)', border: '1px solid var(--hair)', padding: 20, borderRadius: 10 }}>
            <UserMessage>Make the habit cards more playful</UserMessage>
            <AssistantMessage>
              Gave them a soft rotation, bigger icons, and rounder corners. Streak count stays primary. Want to push further?
            </AssistantMessage>
            <DiffCard kind="changed" title="Updated: Home screen" files="3 files · HabitCard, StatCard, theme.ts" onToggle={() => setShowExpanded(!showExpanded)} expanded={showExpanded}/>
          </div>
          <div>
            <div className="t-overline" style={{ marginBottom: 12 }}>Status chips</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              <Chip variant="idle">Idle</Chip>
              <Chip variant="thinking">Thinking</Chip>
              <Chip variant="writing">Writing code</Chip>
              <Chip variant="ready">Ready</Chip>
              <Chip variant="error">Error</Chip>
              <Chip variant="warning">Warning</Chip>
              <Chip variant="draft">Draft</Chip>
              <Chip variant="published">Published</Chip>
            </div>
            <div className="t-overline" style={{ marginBottom: 12 }}>Diff card variants</div>
            <DiffCard kind="added"   title="Added: Settings screen" files="3 files"/>
            <DiffCard kind="changed" title="Updated: Theme — violet → amber" files="2 files"/>
            <DiffCard kind="removed" title="Removed: Placeholder screen" files="1 file"/>
          </div>
        </div>
      </DSSection>

      <DSSection num="07" title="App card" desc="The unit of the dashboard. Thumbnail is a real render, never a placeholder.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { name: 'Streak', edited: '3m ago', status: 'draft' },
            { name: 'Morning Pages', edited: '2h ago', status: 'published' },
            { name: 'Iron Week', edited: 'Yesterday', status: 'published' },
            { name: 'Pan & Co', edited: '4 days ago', status: 'draft' },
          ].map(a => (
            <AppCardDemo key={a.name} {...a}/>
          ))}
        </div>
      </DSSection>

      <DSSection num="08" title="Phone frame" desc="Realistic iPhone 15 Pro — the only hardware shape in the product.">
        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
          <IPhoneFrame width={260}>
            <StreakApp screen="home" theme="default" scale={260/393} />
          </IPhoneFrame>
          <div style={{ flex: 1, paddingBottom: 32 }}>
            <div className="t-body muted" style={{ maxWidth: 440 }}>
              Every preview, marketing shot and case study uses the same frame. It is drawn with CSS — no images — so it scales crisply and inherits the UI's type rendering. Dynamic Island stays closed; the status bar tints to match the app's first screen.
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
              {[
                { label: 'Safe area', value: '54 / 34 px' },
                { label: 'Corner radius', value: '48 px' },
                { label: 'Scale', value: 'width / 393' },
              ].map(s => (
                <div key={s.label}>
                  <div className="t-mono-sm muted">{s.label}</div>
                  <div className="t-mono" style={{ color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DSSection>

      <DSSection num="09" title="Motion" desc="All easing derived from cubic-bezier(0.16, 1, 0.3, 1). No springs. Nothing over 320ms.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { name: 'enter', spec: '200ms · ease-out', desc: 'Modals, sheets, fresh surfaces. Opacity + 8px rise.' },
            { name: 'pulse', spec: '1.4s · ease-in-out ∞', desc: 'Status dot during thinking. Scale 1 → 1.2, opacity 0.5 → 1.' },
            { name: 'diff-card-in', spec: '220ms · ease-out', desc: 'Assistant output. Opacity + 8px rise, staggered by 60ms.' },
          ].map(m => (
            <div key={m.name} style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 20 }}>
              <div className="t-h4">{m.name}</div>
              <div className="t-mono-sm" style={{ color: 'var(--accent)', marginTop: 4 }}>{m.spec}</div>
              <div className="t-caption" style={{ marginTop: 12, color: 'var(--text-muted)' }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </DSSection>

      <div style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12, fontFamily: 'var(--f-mono)', marginTop: 80 }}>
        End of system · Appio · Sprint 2
      </div>
    </div>
  );
};

const DSSection = ({ num, title, desc, children }) => (
  <section style={{ marginBottom: 96, paddingTop: 32, borderTop: '1px solid var(--hair)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 48, marginBottom: 32 }}>
      <div className="t-mono-sm muted">{num}</div>
      <div>
        <div className="t-title">{title}</div>
        <div className="t-body-lg muted" style={{ marginTop: 8, maxWidth: 640 }}>{desc}</div>
      </div>
    </div>
    <div style={{ marginLeft: 168 }}>{children}</div>
  </section>
);

const DSSwatchGroup = ({ label, swatches, light }) => (
  <div style={{
    background: light ? '#F7F5F0' : 'transparent',
    border: light ? 'none' : '1px solid var(--hair)',
    borderRadius: 10, padding: 20,
    color: light ? '#0B0B0F' : 'inherit',
  }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: light ? '#5A5865' : 'var(--text-muted)', marginBottom: 16 }}>{label}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {swatches.map(s => (
        <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: s.hex, border: light ? '1px solid rgba(11,11,15,0.08)' : '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--f-mono)', fontWeight: 500 }}>{s.name}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: light ? '#8A8794' : 'var(--text-subtle)' }}>{s.role}</div>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: light ? '#5A5865' : 'var(--text-muted)' }}>{s.hex}</div>
        </div>
      ))}
    </div>
  </div>
);

const AppCardDemo = ({ name, edited, status }) => (
  <div style={{
    background: 'var(--surface-1)',
    border: '1px solid var(--hair)',
    borderRadius: 'var(--r-card)',
    overflow: 'hidden',
  }}>
    <div style={{
      aspectRatio: '4/5',
      background: 'var(--surface-0)',
      borderBottom: '1px solid var(--hair)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{ transform: 'translateY(20%) scale(0.95)', transformOrigin: 'bottom center' }}>
        <IPhoneFrame width={150}>
          <StreakApp screen="home" theme="default" scale={150/393}/>
        </IPhoneFrame>
      </div>
    </div>
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="t-h4">{name}</div>
        <Icon name="more" size={16} stroke="var(--text-muted)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="t-caption">Edited {edited}</span>
        <Chip variant={status}>{status === 'draft' ? 'Draft' : 'Published'}</Chip>
      </div>
    </div>
  </div>
);

window.DesignSystemFrame = DesignSystemFrame;
window.DesignSystemScreen = DesignSystemFrame;
