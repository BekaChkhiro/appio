// Command Palette — ⌘K overlay
const CommandPalette = ({ onClose }) => {
  const { openModal, navigate, toast } = useApp();
  const [query, setQuery] = React.useState('');
  const [selIdx, setSelIdx] = React.useState(0);

  const items = React.useMemo(() => [
    { group: 'Apps',     icon: 'grid',   label: 'Streak',        hint: 'Habit tracker',   action: () => { navigate('builder'); } },
    { group: 'Apps',     icon: 'grid',   label: 'Morning Pages', hint: 'Journal',         action: () => { navigate('builder'); } },
    { group: 'Apps',     icon: 'grid',   label: 'Iron Week',     hint: 'Workout log',     action: () => { navigate('builder'); } },
    { group: 'Apps',     icon: 'grid',   label: 'Pan & Co',      hint: 'Bakery menu',     action: () => { navigate('builder'); } },
    { group: 'Screens',  icon: 'screen', label: 'Home',          hint: 'Streak',          action: () => { navigate('builder'); } },
    { group: 'Screens',  icon: 'screen', label: 'Habit detail',  hint: 'Streak',          action: () => { navigate('builder'); } },
    { group: 'Screens',  icon: 'screen', label: 'Stats',         hint: 'Streak',          action: () => { navigate('builder'); } },
    { group: 'Screens',  icon: 'screen', label: 'Profile',       hint: 'Streak',          action: () => { navigate('builder'); } },
    { group: 'Commands', icon: 'plus',   label: 'New app',       hint: '⌘ N',             action: () => { navigate('new-project'); } },
    { group: 'Commands', icon: 'globe',  label: 'Publish Streak',hint: '⌘ P',             action: () => { navigate('prepublish'); } },
    { group: 'Commands', icon: 'chart',  label: 'Open analytics',                         action: () => { navigate('analytics'); } },
    { group: 'Commands', icon: 'code',   label: 'Keyboard shortcuts', hint: '?',          action: () => { openModal('shortcuts'); } },
    { group: 'Commands', icon: 'user',   label: 'Account settings',                       action: () => { navigate('account'); } },
    { group: 'Commands', icon: 'lock',   label: 'Sign out',                               action: () => { toast('Signed out', { variant: 'info' }); } },
    { group: 'Frames',   icon: 'panel',  label: 'Design System',                          action: () => { navigate('design-system'); } },
    { group: 'Frames',   icon: 'panel',  label: 'Landing',                                action: () => { navigate('landing'); } },
    { group: 'Frames',   icon: 'panel',  label: 'Builder',                                action: () => { navigate('builder'); } },
    { group: 'Frames',   icon: 'panel',  label: 'Pricing',                                action: () => { navigate('pricing'); } },
    { group: 'Frames',   icon: 'panel',  label: 'Changelog',                              action: () => { navigate('changelog'); } },
    { group: 'Frames',   icon: 'panel',  label: 'Templates',                              action: () => { navigate('templates'); } },
  ], []);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q) || (i.hint && i.hint.toLowerCase().includes(q)) || i.group.toLowerCase().includes(q)).slice(0, 12);
  }, [query, items]);

  React.useEffect(() => { setSelIdx(0); }, [query]);

  // Group items
  const grouped = React.useMemo(() => {
    const out = [];
    let cur = null;
    filtered.forEach((item, i) => {
      if (!cur || cur.group !== item.group) {
        cur = { group: item.group, items: [] };
        out.push(cur);
      }
      cur.items.push({ ...item, flatIdx: i });
    });
    return out;
  }, [filtered]);

  const run = (item) => { item.action && item.action(); onClose(); };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(filtered.length - 1, i + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); if (filtered[selIdx]) run(filtered[selIdx]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, selIdx]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh',
      animation: 'fadeIn 140ms var(--ease-out)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90vw', maxWidth: 640,
        background: 'var(--surface-1)',
        border: '1px solid var(--strong)',
        borderRadius: 'var(--r-modal)',
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
        animation: 'modalIn 220ms var(--ease-out)',
      }}>
        {/* Search input */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="search" size={16} stroke="var(--text-muted)"/>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search apps, screens, docs, or run a command…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 15, fontFamily: 'var(--f-mono)' }}/>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-subtle)', padding: '2px 6px', background: 'var(--surface-2)', borderRadius: 4 }}>ESC</span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '6px 0' }}>
          {grouped.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {grouped.map(g => (
            <div key={g.group}>
              <div className="t-overline" style={{ padding: '10px 18px 6px', fontSize: 10 }}>{g.group}</div>
              {g.items.map(item => {
                const active = item.flatIdx === selIdx;
                return (
                  <div key={item.label + item.flatIdx} onClick={() => run(item)}
                    onMouseEnter={() => setSelIdx(item.flatIdx)}
                    style={{
                      padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 12,
                      background: active ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer',
                      borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                    }}>
                    <Icon name={item.icon} size={14} stroke={active ? 'var(--accent)' : 'var(--text-muted)'}/>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 500 : 400 }}>{item.label}</span>
                    {item.hint && <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>{item.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--hair)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--f-mono)' }}>
          <span>↑ ↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
};

window.CommandPalette = CommandPalette;
