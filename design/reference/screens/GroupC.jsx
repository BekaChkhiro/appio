// Group C — Builder (main, theme picker, thinking, error, code view)

const BuilderScreen = ({ initialState = 'idle', initialCodeView = false, initialThemeModal = false }) => {
  const [state, setState] = React.useState(initialState);
  const [theme, setTheme] = React.useState('default');
  const [playful, setPlayful] = React.useState(false);
  const [showThemeModal, setShowThemeModal] = React.useState(initialThemeModal);
  const [currentScreen, setCurrentScreen] = React.useState('home');
  const [device, setDevice] = React.useState('phone');
  const [codeView, setCodeView] = React.useState(initialCodeView);
  const [messages, setMessages] = React.useState([
    { role: 'user', text: 'build a simple habit tracker called Streak with 4 habits' },
    { role: 'assistant', text: "Made a 4-habit home screen with streak counts, a progress bar, and a tab bar. Start with this?" },
    { role: 'diff', kind: 'added', title: 'Added: Home screen with 4 habits', files: ['Home.tsx', 'HabitCard.tsx', 'theme.ts'] },
    { role: 'user', text: 'make the habit cards more playful' },
    { role: 'assistant', text: "Rounded the corners, nudged each card by a fraction of a degree, bumped the icons. Streak count stays primary." },
    { role: 'diff', kind: 'changed', title: 'Updated: HabitCard', files: ['HabitCard.tsx', 'theme.ts'] },
  ]);
  const [input, setInput] = React.useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    const lower = userMsg.toLowerCase();

    // Rule-based response selection
    let response = "Got it. Applying the change now.";
    let diff = { kind: 'changed', title: 'Updated: Home screen', files: ['Home.tsx'] };

    if (/playful|fun|bouncy|whimsical/.test(lower)) {
      response = "Loosened the grid, added a playful tilt to cards, and warmed the tints a touch. Streak counts stay bold.";
      diff = { kind: 'changed', title: 'Updated: Playful theme applied', files: ['HabitCard.tsx', 'theme.ts'] };
      setPlayful(true);
    } else if (/theme|color|palette/.test(lower)) {
      response = "Opening the theme picker — five personas ready, all with real renders of Streak.";
      setShowThemeModal(true);
      diff = null;
    } else if (/add.*screen|new screen|add.*page/.test(lower)) {
      response = "Added a new screen and wired it into the tab bar. Empty state for now — tell me what goes in it.";
      diff = { kind: 'added', title: 'Added: New screen + nav entry', files: ['Settings.tsx', 'Navigation.tsx'] };
    } else if (/data|convex|database|backend/.test(lower)) {
      response = "Connecting Convex — I'll define a habits table and wire reads/writes. Takes about 20 seconds.";
      diff = { kind: 'added', title: 'Added: Convex schema + hooks', files: ['convex/schema.ts', 'convex/habits.ts'] };
    } else if (/remove|delete|rm/.test(lower)) {
      response = "Removed it. You can restore from Version history if you change your mind.";
      diff = { kind: 'changed', title: 'Removed component', files: ['Home.tsx'] };
    } else if (/bigger|larger|bolder/.test(lower)) {
      response = "Bumped the type scale one step. Display sizes up 15%, body unchanged.";
      diff = { kind: 'changed', title: 'Updated: Type scale', files: ['theme.ts'] };
    }

    setMessages([...messages, { role: 'user', text: userMsg }]);
    setInput('');
    setState('thinking');
    setTimeout(() => {
      setState('writing');
      setMessages(m => [...m, { role: 'assistant', text: response, streaming: true }]);
    }, 900);
    setTimeout(() => {
      setState('ready');
      setMessages(m => {
        const updated = [...m];
        if (updated[updated.length - 1].streaming) updated[updated.length - 1].streaming = false;
        if (!diff) return updated;
        return [...updated, { role: 'diff', ...diff, animate: true }];
      });
    }, 2400);
  };

  const handleQuickChip = (label) => {
    if (label === 'Change theme') { setShowThemeModal(true); return; }
    setInput(label);
  };

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--surface-0)', color: 'var(--text-primary)' }}>
      {/* LEFT sidebar */}
      <div style={{ width: 260, borderRight: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark size={20}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Streak</div>
            <div className="t-caption">Clara's workspace</div>
          </div>
          <Icon name="chevronDown" size={14} stroke="var(--text-muted)"/>
        </div>

        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="t-overline">Screens</div>
          <Icon name="plus" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }}/>
        </div>
        <div style={{ padding: '0 8px', flex: 1, overflow: 'auto' }}>
          {[
            { id: 'home', label: 'Home', icon: 'home' },
            { id: 'detail', label: 'Habit detail', icon: 'flame' },
            { id: 'add', label: 'Add habit', icon: 'plus' },
            { id: 'stats', label: 'Stats', icon: 'chart' },
            { id: 'profile', label: 'You', icon: 'user' },
          ].map(s => (
            <div key={s.id} onClick={() => setCurrentScreen(s.id)} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              background: currentScreen === s.id ? 'var(--surface-2)' : 'transparent',
              color: currentScreen === s.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: currentScreen === s.id ? 500 : 400,
            }}>
              <Icon name={s.icon} size={14}/>
              <span style={{ flex: 1 }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--hair)' }}>
          <Button variant="secondary" full icon="plus" size="sm">Add feature</Button>
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="settings" size={14}/>
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* CENTER canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-0)', position: 'relative', minWidth: 0 }}>
        {/* Top toolbar */}
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--hair)', gap: 10 }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 2, borderRadius: 6 }}>
            {[['phone','phone'],['device','tablet']].map(([d, ico]) => (
              <div key={d} onClick={() => setDevice(d)} style={{
                padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                background: device === d ? 'var(--surface-0)' : 'transparent',
                color: device === d ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                <Icon name={ico} size={14}/>
              </div>
            ))}
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--hair)' }}/>
          <div style={{ display: 'flex', gap: 2 }}>
            <Icon name="minus" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer', padding: 6 }}/>
            <span className="t-mono-sm" style={{ alignSelf: 'center' }}>100%</span>
            <Icon name="plus" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer', padding: 6 }}/>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--hair)' }}/>
          <Icon name="refresh" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer', padding: 6 }}/>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', padding: 2, borderRadius: 6 }}>
              <div onClick={() => setCodeView(false)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: !codeView ? 'var(--surface-0)' : 'transparent', color: !codeView ? 'var(--text-primary)' : 'var(--text-muted)' }}>Preview</div>
              <div onClick={() => setCodeView(true)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer', background: codeView ? 'var(--surface-0)' : 'transparent', color: codeView ? 'var(--text-primary)' : 'var(--text-muted)' }}>Code</div>
            </div>
            <Button variant="secondary" size="sm" icon="external">Open</Button>
            <Button variant="primary" size="sm">Publish</Button>
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
          background: `radial-gradient(circle at 50% 50%, rgba(124,92,255,0.04), transparent 50%),
                       linear-gradient(to right, var(--hair) 1px, transparent 1px) 0 0 / 32px 32px,
                       linear-gradient(to bottom, var(--hair) 1px, transparent 1px) 0 0 / 32px 32px`,
        }}>
          {codeView ? <CodeView/> : (
            <div style={{ textAlign: 'center' }}>
              <IPhoneFrame width={320}>
                <StreakApp screen={currentScreen} theme={theme} playful={playful} scale={320/393} onNavigate={setCurrentScreen}/>
              </IPhoneFrame>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                <Chip variant={state}>
                  {state === 'idle' ? 'Ready' : state === 'thinking' ? 'Thinking' : state === 'writing' ? 'Writing code' : state === 'ready' ? 'Saved · just now' : 'Error'}
                </Chip>
              </div>
            </div>
          )}

          {showThemeModal && <ThemePickerModal selected={theme} onSelect={t => { setTheme(t); setShowThemeModal(false); }} onClose={() => setShowThemeModal(false)}/>}
        </div>
      </div>

      {/* RIGHT chat */}
      <div style={{ width: 420, borderLeft: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'var(--surface-0)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="sparkle" size={16} stroke="var(--accent)"/>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Assistant</div>
          <Chip variant={state === 'error' ? 'error' : 'ready'} style={{ marginLeft: 'auto' }}>
            {state === 'error' ? 'Error' : state === 'thinking' ? 'Thinking' : state === 'writing' ? 'Writing' : 'Ready'}
          </Chip>
        </div>
        <div className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 20px 0' }}>
          {state === 'error' ? <BuilderErrorState onRetry={() => setState('idle')}/> : (
            messages.map((m, i) => {
              if (m.role === 'user') return <UserMessage key={i}>{m.text}</UserMessage>;
              if (m.role === 'assistant') return <AssistantMessage key={i} streaming={m.streaming}>{m.text}</AssistantMessage>;
              if (m.role === 'diff') return <DiffCard key={i} kind={m.kind} title={m.title} files={m.files} animate={m.animate}/>;
              return null;
            })
          )}
          {state === 'thinking' && <ThinkingIndicator/>}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid var(--hair)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflow: 'auto' }}>
            {['Add a screen','Change theme','Connect data','Make playful'].map(c => (
              <span key={c} onClick={() => handleQuickChip(c)} style={{
                flexShrink: 0, fontSize: 12, padding: '5px 10px',
                background: 'var(--surface-2)', border: '1px solid var(--hair)',
                borderRadius: 999, color: 'var(--text-muted)', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>{c}</span>
            ))}
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 12, padding: 10 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Describe a change…" rows={2}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', resize: 'none', fontSize: 14, fontFamily: 'var(--f-ui)' }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Icon name="paperclip" size={16} stroke="var(--text-muted)" style={{ padding: 4, cursor: 'pointer' }}/>
              <Icon name="mic" size={16} stroke="var(--text-muted)" style={{ padding: 4, cursor: 'pointer' }}/>
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="primary" size="sm" icon="arrowUp" onClick={handleSend} disabled={!input.trim()}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThinkingIndicator = () => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0', marginBottom: 16 }}>
    {[0,1,2].map(i => (
      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
        animation: `pulseDot 1.4s ease-in-out ${i * 0.15}s infinite` }}/>
    ))}
    <span className="t-caption" style={{ marginLeft: 4 }}>Thinking…</span>
  </div>
);

const BuilderErrorState = ({ onRetry }) => (
  <div>
    <UserMessage>add a weekly view with a swipeable week picker</UserMessage>
    <div style={{ background: 'var(--danger-soft)', border: '1px solid rgba(244,63,94,0.24)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 12 }}>
      <Icon name="alert" size={18} stroke="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }}/>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>That didn't quite work.</div>
        <div className="t-caption" style={{ color: 'var(--text-muted)' }}>Swipeable week picker conflicted with the existing bottom-nav gesture. I have a couple of ideas.</div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="primary" size="sm" icon="refresh" onClick={onRetry}>Try again</Button>
      <Button variant="secondary" size="sm" icon="wand">Fix with AI</Button>
    </div>
  </div>
);

// ---------- Theme picker ----------
const ThemePickerModal = ({ selected, onSelect, onClose }) => {
  const themes = [
    { id: 'minimal-mono', label: 'Minimal mono', desc: 'Pure black, one type size, restraint.' },
    { id: 'vibrant-gradient', label: 'Vibrant gradient', desc: 'Neon on deep-space. A statement.' },
    { id: 'brutalist-bold', label: 'Brutalist bold', desc: 'Mono type, sharp corners, strong grid.' },
    { id: 'glassmorphic-soft', label: 'Glassmorphic soft', desc: 'Frosted layers over warm gradients.' },
    { id: 'editorial-serif', label: 'Editorial serif', desc: 'Slow, literary, warm dark.' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(11,11,15,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 32 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-1)', border: '1px solid var(--strong)', borderRadius: 14, padding: 32, boxShadow: 'var(--shadow-modal)', maxWidth: 1100, width: '100%', animation: 'diffIn 220ms var(--ease-out)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 6 }}>Theme Persona</div>
            <div className="t-title">Pick a feel.</div>
            <div className="t-body muted" style={{ marginTop: 4 }}>All of them keep the same data, screens, and logic. Only the look changes.</div>
          </div>
          <Icon name="x" size={18} stroke="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose}/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {themes.map(t => {
            const active = selected === t.id;
            return (
              <div key={t.id} onClick={() => onSelect(t.id)} style={{
                background: 'var(--surface-0)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--hair)'}`,
                borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                boxShadow: active ? 'var(--shadow-accent)' : 'none',
                transition: 'all var(--t-fast)',
              }}>
                <div style={{ padding: 16, background: 'var(--surface-1)', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--hair)' }}>
                  <IPhoneFrame width={170}>
                    <StreakApp screen="home" theme={t.id} scale={170/393}/>
                  </IPhoneFrame>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="t-h4">{t.label}</div>
                    {active && <Icon name="check" size={14} stroke="var(--accent)" strokeWidth={2}/>}
                  </div>
                  <div className="t-caption" style={{ marginTop: 4 }}>{t.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- Code view ----------
const CodeView = () => {
  const files = [
    { name: 'app', kind: 'folder', open: true, children: [
      { name: 'Home.tsx', active: true },
      { name: 'HabitCard.tsx' },
      { name: 'HabitDetail.tsx' },
      { name: 'AddHabit.tsx' },
      { name: 'Stats.tsx' },
    ]},
    { name: 'components', kind: 'folder', open: true, children: [
      { name: 'TabBar.tsx' },
      { name: 'ProgressBar.tsx' },
    ]},
    { name: 'theme.ts' },
    { name: 'package.json' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--surface-0)' }}>
      <div style={{ width: 220, borderRight: '1px solid var(--hair)', padding: 12, overflow: 'auto' }}>
        <div className="t-overline" style={{ marginBottom: 8, padding: '0 6px' }}>Files</div>
        {files.map(f => <FileTreeItem key={f.name} item={f}/>)}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--hair)', display: 'flex', gap: 4 }}>
          <div style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'var(--f-mono)', background: 'var(--surface-2)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            Home.tsx <Icon name="x" size={11} stroke="var(--text-muted)"/>
          </div>
          <div style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--text-muted)', borderRadius: 6 }}>HabitCard.tsx</div>
        </div>
        <div className="scroll" style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '16px 0' }}>
          <CodeBlock lines={CODE_LINES}/>
        </div>
      </div>
    </div>
  );
};

const FileTreeItem = ({ item, depth = 0 }) => {
  const [open, setOpen] = React.useState(item.open !== false);
  const pad = 8 + depth * 14;
  if (item.kind === 'folder') {
    return <>
      <div onClick={() => setOpen(!open)} style={{ padding: `4px ${pad}px`, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10}/>
        <span>{item.name}</span>
      </div>
      {open && item.children.map(c => <FileTreeItem key={c.name} item={c} depth={depth + 1}/>)}
    </>;
  }
  return (
    <div style={{ padding: `4px ${pad}px 4px ${pad + 14}px`, fontSize: 12, color: item.active ? 'var(--text-primary)' : 'var(--text-muted)', background: item.active ? 'var(--surface-2)' : 'transparent', borderRadius: 4, cursor: 'pointer' }}>
      {item.name}
    </div>
  );
};

const CODE_LINES = [
  { t: 'import', parts: [['kw', 'import '], ['id', '{ Habit } '], ['kw', 'from '], ['str', "'./types'"], ['', ';']] },
  { t: 'import', parts: [['kw', 'import '], ['id', 'HabitCard '], ['kw', 'from '], ['str', "'./HabitCard'"], ['', ';']] },
  { t: 'blank' },
  { parts: [['kw', 'export default function '], ['fn', 'Home'], ['', '() {']] },
  { parts: [['', '  '], ['kw', 'const '], ['id', 'habits '], ['', '= '], ['fn', 'useHabits'], ['', '();']] },
  { parts: [['', '  '], ['kw', 'const '], ['id', 'completed '], ['', '= habits.'], ['fn', 'filter'], ['', '(h => h.done).length;']] },
  { t: 'blank' },
  { parts: [['', '  '], ['kw', 'return '], ['', '(']] },
  { parts: [['', '    <'], ['tag', 'main'], ['', ' '], ['attr', 'className'], ['', '='], ['str', '"home"'], ['', '>']] },
  { parts: [['', '      <'], ['tag', 'h1'], ['', '>Morning, {user.name}.</'], ['tag', 'h1'], ['', '>']] },
  { parts: [['', '      <'], ['tag', 'Progress'], ['', ' '], ['attr', 'value'], ['', '={completed} '], ['attr', 'max'], ['', '={habits.length} />']] },
  { parts: [['', '      {habits.'], ['fn', 'map'], ['', '(h => <'], ['tag', 'HabitCard'], ['', ' '], ['attr', 'key'], ['', '={h.id} '], ['attr', 'habit'], ['', '={h} />)}']] },
  { parts: [['', '    </'], ['tag', 'main'], ['', '>']] },
  { parts: [['', '  );']] },
  { parts: [['', '}']] },
];

const CODE_COLORS = {
  kw: '#C4B5FD', fn: '#7DD3FC', tag: '#F5A524', attr: '#6EE7B7', str: '#FCA5A5', id: 'var(--text-primary)', '': 'var(--text-primary)',
};

const CodeBlock = ({ lines }) => (
  <div>
    {lines.map((l, i) => (
      <div key={i} style={{ padding: '0 20px', display: 'flex', minHeight: 20, lineHeight: '20px' }}>
        <span style={{ color: 'var(--text-subtle)', width: 28, textAlign: 'right', marginRight: 16, userSelect: 'none' }}>{i + 1}</span>
        <span>
          {l.parts && l.parts.map((p, j) => <span key={j} style={{ color: CODE_COLORS[p[0]] }}>{p[1]}</span>)}
        </span>
      </div>
    ))}
  </div>
);

// Sub-states
const BuilderThinkingScreen = () => <BuilderScreen initialState="thinking"/>;
const BuilderErrorScreen = () => <BuilderScreen initialState="error"/>;
const BuilderCodeScreen = () => <BuilderScreen initialCodeView={true}/>;
const BuilderThemeScreen = () => <BuilderScreen initialThemeModal={true}/>;

Object.assign(window, { BuilderScreen, BuilderThinkingScreen, BuilderErrorScreen, BuilderThemeScreen, BuilderCodeScreen });
