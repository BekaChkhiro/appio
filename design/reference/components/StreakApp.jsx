// "Streak" — a fictional habit tracker. The hero preview used throughout Appio.
// 5 navigable screens: Home, Habit Detail, Add Habit, Stats, Profile

const STREAK_THEMES = {
  'minimal-mono': {
    bg: '#FAFAF7', surface: '#fff', text: '#0B0B0F', muted: '#8A8794',
    accent: '#0B0B0F', accentFg: '#fff', hair: 'rgba(11,11,15,0.08)',
    font: "'General Sans', ui-sans-serif",
  },
  'vibrant-gradient': {
    bg: '#0a0614', surface: 'rgba(255,255,255,0.06)', text: '#fff', muted: 'rgba(255,255,255,0.6)',
    accent: 'linear-gradient(135deg, #FF6B9D, #C471F5 60%, #4A90E2)', accentFg: '#fff',
    hair: 'rgba(255,255,255,0.1)', font: "'General Sans', ui-sans-serif",
  },
  'brutalist-bold': {
    bg: '#F2EFDF', surface: '#fff', text: '#000', muted: '#555',
    accent: '#FF4D1A', accentFg: '#000', hair: '#000',
    font: "'JetBrains Mono', monospace",
  },
  'glassmorphic-soft': {
    bg: 'linear-gradient(160deg, #e0e7ff, #fbcfe8 70%, #fef3c7)', surface: 'rgba(255,255,255,0.55)', text: '#1a1a2e', muted: '#6a6a8a',
    accent: '#7C5CFF', accentFg: '#fff', hair: 'rgba(255,255,255,0.7)',
    font: "'General Sans', ui-sans-serif",
  },
  'editorial-serif': {
    bg: '#1a1816', surface: '#2a2824', text: '#EDE6D9', muted: '#998E7A',
    accent: '#D4A574', accentFg: '#1a1816', hair: 'rgba(237,230,217,0.1)',
    font: "'Fraunces', Georgia, serif",
  },
};

// Habit data
const HABITS = [
  { id: 'meditate', name: 'Meditate', time: '7 min', streak: 12, done: true,  icon: 'leaf',  tint: '#6EE7B7' },
  { id: 'read',     name: 'Read',     time: '30 min', streak: 8,  done: true,  icon: 'book',  tint: '#FDE68A' },
  { id: 'workout',  name: 'Workout',  time: '45 min', streak: 24, done: false, icon: 'dumbbell', tint: '#FCA5A5' },
  { id: 'journal',  name: 'Journal',  time: '10 min', streak: 5,  done: false, icon: 'flame', tint: '#C4B5FD' },
];

const StreakApp = ({ screen = 'home', theme = 'default', playful = false, scale = 1, onNavigate }) => {
  // default theme — uses Appio tokens
  const t = theme === 'default' ? null : STREAK_THEMES[theme];

  const px = (n) => n * scale;

  // Default (dark, Appio-aligned) tokens
  const tokens = t || {
    bg: '#0B0B0F', surface: '#141418', text: '#F5F3EE', muted: '#8A8794',
    accent: '#7C5CFF', accentFg: '#fff', hair: 'rgba(255,255,255,0.06)',
    font: "'General Sans', ui-sans-serif",
  };

  const screens = {
    home: <StreakHome tokens={tokens} scale={scale} playful={playful} onNavigate={onNavigate} />,
    detail: <StreakDetail tokens={tokens} scale={scale} />,
    add: <StreakAdd tokens={tokens} scale={scale} />,
    stats: <StreakStats tokens={tokens} scale={scale} />,
    profile: <StreakProfile tokens={tokens} scale={scale} />,
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: tokens.bg,
      color: tokens.text,
      fontFamily: tokens.font,
      position: 'relative',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {screens[screen]}
      </div>
      <StreakTabBar tokens={tokens} scale={scale} active={screen} onNavigate={onNavigate} />
    </div>
  );
};

// ---------- Home ----------
const StreakHome = ({ tokens, scale, playful, onNavigate }) => {
  const px = (n) => n * scale;
  const completed = HABITS.filter(h => h.done).length;
  return (
    <div style={{ padding: `${px(8)}px ${px(20)}px ${px(16)}px`, overflow: 'auto', height: '100%' }}>
      <div style={{ marginTop: px(6), marginBottom: px(20) }}>
        <div style={{ fontSize: px(11), letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.muted, fontWeight: 600 }}>
          Wednesday, Apr 22
        </div>
        <div style={{ fontSize: px(26), fontWeight: 600, letterSpacing: '-0.02em', marginTop: px(2) }}>
          Morning, Clara.
        </div>
      </div>

      {/* Big stat card */}
      <div style={{
        background: tokens.surface,
        border: `1px solid ${tokens.hair}`,
        borderRadius: px(playful ? 20 : 12),
        padding: px(16),
        marginBottom: px(16),
        position: 'relative',
        overflow: 'hidden',
      }}>
        {playful && (
          <div style={{
            position: 'absolute', right: -px(30), top: -px(20),
            width: px(120), height: px(120), borderRadius: '50%',
            background: typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF',
            opacity: 0.12, filter: 'blur(20px)',
          }} />
        )}
        <div style={{ fontSize: px(11), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Today</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: px(6), marginTop: px(4) }}>
          <span style={{ fontSize: px(36), fontWeight: 600, letterSpacing: '-0.03em' }}>{completed}</span>
          <span style={{ fontSize: px(18), color: tokens.muted }}>/ {HABITS.length} habits</span>
        </div>
        {/* Progress bar */}
        <div style={{
          marginTop: px(12),
          height: px(6), borderRadius: px(3),
          background: tokens.hair, overflow: 'hidden',
        }}>
          <div style={{
            width: `${(completed/HABITS.length)*100}%`, height: '100%',
            background: typeof tokens.accent === 'string' ? tokens.accent : tokens.accent,
            borderRadius: px(3),
          }} />
        </div>
      </div>

      {/* Habit list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: px(playful ? 12 : 8) }}>
        {HABITS.map(h => (
          <div key={h.id}
            onClick={() => onNavigate && onNavigate('detail')}
            style={{
              background: tokens.surface,
              border: `1px solid ${tokens.hair}`,
              borderRadius: px(playful ? 18 : 10),
              padding: px(playful ? 16 : 14),
              display: 'flex', alignItems: 'center', gap: px(12),
              cursor: 'pointer',
              transform: playful ? `rotate(${(Math.random()-0.5)*0.8}deg)` : 'none',
            }}>
            {/* Icon tile */}
            <div style={{
              width: px(playful ? 44 : 38), height: px(playful ? 44 : 38),
              borderRadius: px(playful ? 14 : 8),
              background: playful ? h.tint : `${h.tint}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: playful ? '#0B0B0F' : h.tint, flexShrink: 0,
            }}>
              <window.Icon name={h.icon} size={px(playful ? 22 : 18)} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: px(15), fontWeight: 600, letterSpacing: '-0.01em' }}>{h.name}</div>
              <div style={{ fontSize: px(12), color: tokens.muted, marginTop: px(1), display: 'flex', gap: px(8), alignItems: 'center' }}>
                <span>{h.time}</span>
                <span style={{ width: px(2), height: px(2), borderRadius: '50%', background: tokens.muted }}/>
                <window.Icon name="flame" size={px(11)} />
                <span>{h.streak} day streak</span>
              </div>
            </div>
            {/* Check */}
            <div style={{
              width: px(playful ? 30 : 26), height: px(playful ? 30 : 26),
              borderRadius: '50%',
              border: h.done ? 'none' : `1.5px solid ${tokens.muted}`,
              background: h.done ? (typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF') : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tokens.accentFg,
            }}>
              {h.done && <window.Icon name="check" size={px(14)} strokeWidth={2.5} stroke={tokens.accentFg} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Detail ----------
const StreakDetail = ({ tokens, scale }) => {
  const px = (n) => n * scale;
  return (
    <div style={{ padding: `${px(8)}px ${px(20)}px`, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: px(16), marginTop: px(6) }}>
        <window.Icon name="chevronLeft" size={px(22)} stroke={tokens.text} />
        <window.Icon name="more" size={px(20)} stroke={tokens.text} style={{ marginLeft: 'auto' }} />
      </div>
      <div style={{
        width: px(64), height: px(64), borderRadius: px(16),
        background: '#FCA5A555', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: px(14), color: '#FCA5A5',
      }}>
        <window.Icon name="dumbbell" size={px(32)} />
      </div>
      <div style={{ fontSize: px(28), fontWeight: 600, letterSpacing: '-0.02em' }}>Workout</div>
      <div style={{ fontSize: px(13), color: tokens.muted, marginTop: px(2) }}>45 minutes · 6 AM daily</div>

      {/* Streak number */}
      <div style={{
        marginTop: px(20),
        padding: px(16),
        background: tokens.surface,
        border: `1px solid ${tokens.hair}`,
        borderRadius: px(12),
        display: 'flex', alignItems: 'center', gap: px(14),
      }}>
        <div style={{ fontSize: px(48), fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>24</div>
        <div>
          <div style={{ fontSize: px(13), fontWeight: 600 }}>Day streak</div>
          <div style={{ fontSize: px(11), color: tokens.muted }}>Best: 31 days</div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#F5A524' }}>
          <window.Icon name="flame" size={px(28)} />
        </div>
      </div>

      {/* Month grid */}
      <div style={{ marginTop: px(20) }}>
        <div style={{ fontSize: px(11), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: px(10) }}>
          April
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: px(4) }}>
          {Array.from({length: 30}).map((_, i) => {
            const done = [1,2,3,5,6,7,8,10,11,12,14,15,16,17,18,19,20,21].includes(i);
            const today = i === 21;
            return (
              <div key={i} style={{
                aspectRatio: '1',
                borderRadius: px(6),
                background: done ? (typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF') : tokens.hair,
                opacity: done ? 1 : 0.5,
                border: today ? `1.5px solid ${tokens.text}` : 'none',
              }}/>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- Add Habit ----------
const StreakAdd = ({ tokens, scale }) => {
  const px = (n) => n * scale;
  const iconOptions = ['leaf', 'book', 'dumbbell', 'flame', 'coffee', 'cake'];
  return (
    <div style={{ padding: `${px(8)}px ${px(20)}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: px(16), marginTop: px(6) }}>
        <window.Icon name="x" size={px(22)} stroke={tokens.text} />
        <div style={{ marginLeft: 'auto', fontSize: px(14), fontWeight: 600, color: typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF' }}>Save</div>
      </div>
      <div style={{ fontSize: px(28), fontWeight: 600, letterSpacing: '-0.02em', marginBottom: px(20) }}>New habit</div>

      <div style={{
        padding: px(14), background: tokens.surface, border: `1px solid ${tokens.hair}`,
        borderRadius: px(10), marginBottom: px(12),
      }}>
        <div style={{ fontSize: px(10), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: px(6) }}>Name</div>
        <div style={{ fontSize: px(17), fontWeight: 500 }}>Drink water<span style={{ color: tokens.muted, animation: 'streamBlink 1s infinite', marginLeft: px(1) }}>|</span></div>
      </div>

      <div style={{ padding: px(14), background: tokens.surface, border: `1px solid ${tokens.hair}`, borderRadius: px(10), marginBottom: px(12) }}>
        <div style={{ fontSize: px(10), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: px(10) }}>Icon</div>
        <div style={{ display: 'flex', gap: px(8), flexWrap: 'wrap' }}>
          {iconOptions.map((ic, i) => (
            <div key={ic} style={{
              width: px(38), height: px(38), borderRadius: px(8),
              background: i === 4 ? (typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF') : tokens.hair,
              color: i === 4 ? tokens.accentFg : tokens.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <window.Icon name={ic} size={px(18)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: px(14), background: tokens.surface, border: `1px solid ${tokens.hair}`, borderRadius: px(10) }}>
        <div style={{ fontSize: px(10), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: px(10) }}>Repeat</div>
        <div style={{ display: 'flex', gap: px(6) }}>
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <div key={i} style={{
              flex: 1, aspectRatio: '1', borderRadius: '50%',
              background: i < 5 ? (typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF') : tokens.hair,
              color: i < 5 ? tokens.accentFg : tokens.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: px(13), fontWeight: 600,
            }}>{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Stats ----------
const StreakStats = ({ tokens, scale }) => {
  const px = (n) => n * scale;
  const bars = [3,4,4,2,4,3,4,4,3,4,4,2,3,4,4,3,4,4,4,3,4,4,3,4,3,4,4,2,3,4];
  return (
    <div style={{ padding: `${px(8)}px ${px(20)}px`, overflow: 'auto', height: '100%' }}>
      <div style={{ fontSize: px(26), fontWeight: 600, letterSpacing: '-0.02em', marginTop: px(8), marginBottom: px(16) }}>Stats</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: px(10), marginBottom: px(16) }}>
        {[
          { label: 'Completion', value: '87%' },
          { label: 'Best streak', value: '24' },
          { label: 'Total days',  value: '142' },
          { label: 'This month', value: '26/30' },
        ].map(s => (
          <div key={s.label} style={{ padding: px(14), background: tokens.surface, border: `1px solid ${tokens.hair}`, borderRadius: px(10) }}>
            <div style={{ fontSize: px(10), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: px(24), fontWeight: 600, letterSpacing: '-0.02em', marginTop: px(4) }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: px(14), background: tokens.surface, border: `1px solid ${tokens.hair}`, borderRadius: px(10) }}>
        <div style={{ fontSize: px(10), color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: px(10) }}>Last 30 days</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: px(3), height: px(90) }}>
          {bars.map((v, i) => (
            <div key={i} style={{
              flex: 1, height: `${(v/4)*100}%`,
              background: typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF',
              borderRadius: px(2), opacity: 0.3 + (v/4) * 0.7,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Profile ----------
const StreakProfile = ({ tokens, scale }) => {
  const px = (n) => n * scale;
  return (
    <div style={{ padding: `${px(8)}px ${px(20)}px`, overflow: 'auto', height: '100%' }}>
      <div style={{ fontSize: px(26), fontWeight: 600, letterSpacing: '-0.02em', marginTop: px(8), marginBottom: px(16) }}>You</div>
      <div style={{
        padding: px(16), background: tokens.surface, border: `1px solid ${tokens.hair}`, borderRadius: px(12),
        display: 'flex', alignItems: 'center', gap: px(12), marginBottom: px(16),
      }}>
        <div style={{
          width: px(52), height: px(52), borderRadius: '50%',
          background: `linear-gradient(135deg, ${typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF'}, #F5A524)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: px(20), fontWeight: 600,
        }}>C</div>
        <div>
          <div style={{ fontSize: px(17), fontWeight: 600 }}>Clara</div>
          <div style={{ fontSize: px(12), color: tokens.muted }}>Since January 2026</div>
        </div>
      </div>
      {['Notifications','Theme','Privacy','Export data','About'].map((l, i) => (
        <div key={l} style={{
          padding: `${px(14)}px ${px(16)}px`,
          background: tokens.surface,
          border: `1px solid ${tokens.hair}`,
          borderTopLeftRadius: i === 0 ? px(10) : 0,
          borderTopRightRadius: i === 0 ? px(10) : 0,
          borderBottomLeftRadius: i === 4 ? px(10) : 0,
          borderBottomRightRadius: i === 4 ? px(10) : 0,
          borderTop: i === 0 ? `1px solid ${tokens.hair}` : 'none',
          display: 'flex', alignItems: 'center',
          fontSize: px(15),
        }}>
          <span>{l}</span>
          <window.Icon name="chevronRight" size={px(16)} stroke={tokens.muted} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
};

// ---------- Tab Bar ----------
const StreakTabBar = ({ tokens, scale, active, onNavigate }) => {
  const px = (n) => n * scale;
  const tabs = [
    { id: 'home', icon: 'home' },
    { id: 'stats', icon: 'chart' },
    { id: 'add', icon: 'plus', special: true },
    { id: 'detail', icon: 'flame' },
    { id: 'profile', icon: 'user' },
  ];
  return (
    <div style={{
      padding: `${px(8)}px ${px(20)}px ${px(8)}px`,
      borderTop: `1px solid ${tokens.hair}`,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      background: tokens.bg,
    }}>
      {tabs.map(t => (
        <div key={t.id} onClick={() => onNavigate && onNavigate(t.id)} style={{
          padding: px(6), cursor: 'pointer',
          color: active === t.id ? (typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF') : tokens.muted,
        }}>
          {t.special ? (
            <div style={{
              width: px(36), height: px(36), borderRadius: '50%',
              background: typeof tokens.accent === 'string' ? tokens.accent : '#7C5CFF',
              color: tokens.accentFg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <window.Icon name="plus" size={px(18)} strokeWidth={2.2} />
            </div>
          ) : (
            <window.Icon name={t.icon} size={px(22)} strokeWidth={active === t.id ? 2 : 1.5} />
          )}
        </div>
      ))}
    </div>
  );
};

window.StreakApp = StreakApp;
window.STREAK_THEMES = STREAK_THEMES;
