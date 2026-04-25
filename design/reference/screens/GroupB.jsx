// Group B — Dashboard, Empty, New project modal

const DashboardScreen = () => {
  const [filter, setFilter] = React.useState('all');
  const apps = [
    { name: 'Streak', edited: '3m ago', status: 'draft', tint: '#7C5CFF', screen: 'home', theme: 'default' },
    { name: 'Morning Pages', edited: '2h ago', status: 'published', tint: '#C4B5FD', screen: 'home', theme: 'editorial-serif' },
    { name: 'Iron Week', edited: 'Yesterday', status: 'published', tint: '#FCA5A5', screen: 'stats', theme: 'brutalist-bold' },
    { name: 'Pan & Co', edited: '4 days ago', status: 'draft', tint: '#FDE68A', screen: 'home', theme: 'minimal-mono' },
    { name: 'devonlin.app', edited: 'Apr 12', status: 'published', tint: '#6EE7B7', screen: 'profile', theme: 'vibrant-gradient' },
    { name: 'Pocket Journal', edited: 'Apr 8', status: 'draft', tint: '#F5A524', screen: 'home', theme: 'glassmorphic-soft' },
  ];
  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <TopNav active="Projects"/>
      <div style={{ padding: '48px 64px', maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <div className="t-overline" style={{ marginBottom: 8 }}>6 projects</div>
            <div className="t-display">Your apps</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input icon="search" placeholder="Search…" style={{ width: 240 }}/>
            <Button variant="primary" icon="plus">New app</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 32, borderBottom: '1px solid var(--hair)' }}>
          {[['all','All'],['draft','Drafts'],['published','Published']].map(([k, l]) => (
            <div key={k} onClick={() => setFilter(k)} style={{
              padding: '10px 16px',
              fontSize: 13, fontWeight: 500,
              color: filter === k ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: filter === k ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
            }}>
              {l} <span style={{ color: 'var(--text-subtle)', marginLeft: 4 }}>{k === 'all' ? apps.length : apps.filter(a => a.status === k).length}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <NewAppTile/>
          {filtered.map(a => <AppCard key={a.name} {...a}/>)}
        </div>
      </div>
    </div>
  );
};

const TopNav = ({ active }) => (
  <div style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hair)', background: 'var(--surface-0)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoMark size={20}/>
        <span style={{ fontFamily: 'var(--f-display)', fontSize: 16, fontWeight: 600 }}>Appio</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {['Projects','Templates','Docs'].map(t => (
          <div key={t} style={{
            padding: '6px 12px', fontSize: 13, fontWeight: 500,
            color: active === t ? 'var(--text-primary)' : 'var(--text-muted)',
            background: active === t ? 'var(--surface-2)' : 'transparent',
            borderRadius: 6, cursor: 'pointer',
          }}>{t}</div>
        ))}
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Icon name="bell" size={18} stroke="var(--text-muted)"/>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>C</div>
    </div>
  </div>
);

const NewAppTile = () => (
  <div style={{
    background: 'var(--surface-0)',
    border: '1.5px dashed var(--strong)', borderRadius: 'var(--r-card)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, cursor: 'pointer',
    aspectRatio: '4/5.2',
    transition: 'border-color var(--t-fast), background var(--t-fast)',
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--strong)'; e.currentTarget.style.background = 'var(--surface-0)'; }}
  >
    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', marginBottom: 14 }}>
      <Icon name="plus" size={20} strokeWidth={2}/>
    </div>
    <div className="t-h4">New app</div>
    <div className="t-caption" style={{ marginTop: 4 }}>Start from a sentence</div>
  </div>
);

const AppCard = ({ name, edited, status, tint, screen = 'home', theme = 'default' }) => (
  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 'var(--r-card)', overflow: 'hidden', cursor: 'pointer', transition: 'border-color var(--t-fast)' }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hair)'}>
    <div style={{ aspectRatio: '4/4.2', background: `linear-gradient(160deg, ${tint}15, var(--surface-0))`, borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ transform: 'translateY(18%)' }}>
        <IPhoneFrame width={150}>
          <StreakApp screen={screen} theme={theme} scale={150/393}/>
        </IPhoneFrame>
      </div>
    </div>
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="t-h4">{name}</div>
        <Icon name="moreV" size={16} stroke="var(--text-muted)"/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="t-caption">Edited {edited}</span>
        <Chip variant={status}>{status === 'draft' ? 'Draft' : 'Published'}</Chip>
      </div>
    </div>
  </div>
);

// ---------- Empty dashboard ----------
const EmptyDashboardScreen = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="Projects"/>
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ width: 72, height: 72, margin: '0 auto 28px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={32}/>
        </div>
        <div className="t-display" style={{ marginBottom: 16 }}>Your first app is one sentence away.</div>
        <div className="t-body-lg muted" style={{ marginBottom: 32 }}>
          What do you want to build? A habit tracker. A wedding RSVP. A dashboard for your bakery. Anything you can describe, Appio can make.
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="primary" size="lg" icon="sparkle">Start from scratch</Button>
          <Button variant="secondary" size="lg">Browse templates</Button>
        </div>
      </div>
    </div>
  </div>
);

// ---------- New project modal ----------
const NewProjectModal = ({ onClose }) => {
  const [val, setVal] = React.useState('');
  const templates = [
    { label: 'Habit tracker', icon: 'flame' },
    { label: 'Recipe box', icon: 'cake' },
    { label: 'Workout log', icon: 'dumbbell' },
    { label: 'Journal', icon: 'book' },
    { label: 'Link-in-bio', icon: 'link' },
    { label: 'Event RSVP', icon: 'calendar' },
  ];
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(11,11,15,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 48, zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 680,
        background: 'var(--surface-1)',
        border: '1px solid var(--strong)',
        borderRadius: 'var(--r-modal)',
        padding: 32,
        boxShadow: 'var(--shadow-modal)',
        animation: 'diffIn 220ms var(--ease-out)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="t-h3">New app</div>
          <Icon name="x" size={18} stroke="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose}/>
        </div>
        <div className="t-caption" style={{ marginBottom: 10 }}>Describe your app in one sentence</div>
        <div style={{ background: 'var(--surface-0)', border: `1px solid ${val ? 'var(--accent)' : 'var(--hair)'}`, borderRadius: 10, padding: 16, transition: 'border-color var(--t-fast)' }}>
          <textarea value={val} onChange={e => setVal(e.target.value)} rows={3} autoFocus placeholder="A quiet habit tracker with streaks and a morning routine mode"
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--f-display)', fontSize: 20, letterSpacing: '-0.01em', resize: 'none' }}/>
        </div>
        <div style={{ marginTop: 28 }}>
          <div className="t-overline" style={{ marginBottom: 12 }}>Or start from a template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {templates.map(t => (
              <div key={t.label} style={{
                padding: '12px 14px',
                background: 'var(--surface-0)', border: '1px solid var(--hair)',
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all var(--t-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hair)'; e.currentTarget.style.background = 'var(--surface-0)'; }}
              >
                <Icon name={t.icon} size={16} stroke="var(--text-muted)"/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" trailingIcon="arrowRight" disabled={!val}>Start building</Button>
        </div>
      </div>
    </div>
  );
};

const NewProjectModalScreen = () => (
  <div style={{ position: 'relative', height: '100%' }}>
    <div style={{ filter: 'blur(0)', height: '100%', pointerEvents: 'none' }}>
      <DashboardScreen/>
    </div>
    <NewProjectModal onClose={() => {}}/>
  </div>
);

const DashboardEmptyScreen = EmptyDashboardScreen;
Object.assign(window, { DashboardScreen, EmptyDashboardScreen, DashboardEmptyScreen, NewProjectModalScreen, TopNav, AppCard });
