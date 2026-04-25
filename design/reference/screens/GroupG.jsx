// Group G — System state templates + Journey map

const EmptyStateTemplate = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="Projects"/>
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--hair)' }}>
      {[
        { icon: 'sparkle', title: 'No projects yet', body: 'Describe an idea to start your first one.', cta: 'New app' },
        { icon: 'search', title: 'No results', body: 'Nothing matched "pomodoro". Try another word or clear the search.', cta: 'Clear search' },
        { icon: 'chart', title: 'No data to chart yet', body: 'Come back once your app has a day of usage.', cta: 'Open app' },
      ].map((e, i) => (
        <div key={i} style={{ padding: 48, borderRight: i < 2 ? '1px solid var(--hair)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface-2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Icon name={e.icon} size={24}/>
          </div>
          <div className="t-h3" style={{ marginBottom: 8 }}>{e.title}</div>
          <div className="t-body muted" style={{ maxWidth: 280, marginBottom: 20 }}>{e.body}</div>
          <Button variant="secondary" size="sm">{e.cta}</Button>
        </div>
      ))}
    </div>
  </div>
);

const ErrorStateTemplate = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="Projects"/>
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--hair)' }}>
      {[
        { icon: 'alert', title: "That didn't work", body: 'Generation failed. Try a different phrasing or ask Appio to fix it for you.', cta: 'Try again', color: 'var(--danger)' },
        { icon: 'globe', title: 'Offline', body: 'No network. Changes will save once you reconnect.', cta: 'Retry', color: 'var(--warning)' },
        { icon: 'x', title: 'Something broke', body: 'Error 500 · An incident report was sent. Nothing you did.', cta: 'Reload', color: 'var(--danger)' },
      ].map((e, i) => (
        <div key={i} style={{ padding: 48, borderRight: i < 2 ? '1px solid var(--hair)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: i === 1 ? 'var(--warning-soft)' : 'var(--danger-soft)', color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Icon name={e.icon} size={24}/>
          </div>
          <div className="t-h3" style={{ marginBottom: 8 }}>{e.title}</div>
          <div className="t-body muted" style={{ maxWidth: 280, marginBottom: 20 }}>{e.body}</div>
          <Button variant="secondary" size="sm" icon="refresh">{e.cta}</Button>
        </div>
      ))}
    </div>
  </div>
);

const LoadingSkeletonTemplate = () => (
  <div style={{ height: '100%', background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="Projects"/>
    <div style={{ padding: '48px 64px' }}>
      <div className="t-overline" style={{ marginBottom: 16 }}>Loading states</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ aspectRatio: '4/4.2', background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}/>
            <div style={{ padding: 14 }}>
              <div style={{ height: 12, width: '60%', background: 'var(--surface-2)', borderRadius: 4, marginBottom: 10, backgroundImage: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}/>
              <div style={{ height: 10, width: '40%', background: 'var(--surface-2)', borderRadius: 4, backgroundImage: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}/>
            </div>
          </div>
        ))}
      </div>

      <div className="t-overline" style={{ margin: '48px 0 16px' }}>Inline loaders</div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 24 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: `${30 + i*10}%`, background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite', borderRadius: 4, marginBottom: 8 }}/>
              <div style={{ height: 10, width: `${20 + i*8}%`, background: 'linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2))', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite', borderRadius: 4 }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---------- Journey Map ----------
const JourneyMap = () => {
  const nodes = [
    { id: 6,  title: 'New project modal', desc: 'Creator types one sentence.',          x: 40,  y: 50 },
    { id: 7,  title: 'Builder',           desc: 'Watches the app take shape live.',     x: 300, y: 200 },
    { id: 12, title: 'Pre-publish review',desc: '"Ready to go live?"',                  x: 600, y: 50 },
    { id: 14, title: 'Publishing',        desc: 'Real-time deploy log.',                x: 880, y: 220 },
    { id: 15, title: 'Published',         desc: 'Live URL, QR, share.',                 x: 1160, y: 60 },
  ];
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)', padding: '48px 64px' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="t-overline" style={{ color: 'var(--accent)', marginBottom: 8 }}>Key journey</div>
        <div className="t-display">Idea → live URL.</div>
        <div className="t-body-lg muted" style={{ maxWidth: 680, marginTop: 8 }}>
          The core build-to-publish flow. Everything else in Appio orbits these five moments.
        </div>
      </div>

      <div style={{ position: 'relative', minWidth: 1400, minHeight: 620, background: `linear-gradient(to right, var(--hair) 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(to bottom, var(--hair) 1px, transparent 1px) 0 0 / 40px 40px`, borderRadius: 12, border: '1px solid var(--hair)', padding: 20 }}>
        {/* Arrows */}
        <svg width="1400" height="620" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L0,10 L8,5 Z" fill="var(--accent)"/>
            </marker>
          </defs>
          {[[0,1],[1,2],[2,3],[3,4]].map(([a, b]) => {
            const A = nodes[a], B = nodes[b];
            const x1 = A.x + 240, y1 = A.y + 320;
            const x2 = B.x, y2 = B.y + 160;
            const mx = (x1 + x2) / 2;
            return <path key={`${a}-${b}`} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" markerEnd="url(#arrowhead)" opacity="0.6"/>;
          })}
        </svg>

        {nodes.map((n, i) => (
          <div key={n.id} style={{ position: 'absolute', top: n.y, left: n.x, width: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'var(--f-mono)', fontWeight: 700 }}>{i + 1}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-muted)' }}>Screen {n.id}</div>
            </div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--strong)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ aspectRatio: '4/3', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                <JourneyThumb id={n.id}/>
                {/* Hotspot */}
                <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 6px', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 10, fontFamily: 'var(--f-mono)', fontWeight: 600, borderRadius: 4 }}>
                  {i === 0 ? 'Start' : i === nodes.length - 1 ? 'Goal' : 'Step'}
                </div>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div className="t-caption" style={{ marginTop: 4 }}>{n.desc}</div>
              </div>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--accent)', fontStyle: 'italic' }}>
                {['Hits "Start building"','After 15m of chat','Clicks "Connect Convex & publish"','~30 seconds later'][i]}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {[
          { k: 'Time to first publish', v: '< 3 hours (avg)' },
          { k: 'Drop-off risk',         v: 'Convex connect (screen 13)' },
          { k: 'Best moment',           v: 'QR appears on screen 15' },
        ].map(s => (
          <div key={s.k} style={{ padding: 20, background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10 }}>
            <div className="t-caption" style={{ marginBottom: 4 }}>{s.k}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const JourneyThumb = ({ id }) => {
  if (id === 6) return <div style={{ width: '80%', height: '70%', background: 'var(--surface-2)', border: '1px solid var(--hair)', borderRadius: 8, padding: 12 }}>
    <div style={{ height: 8, width: '50%', background: 'var(--text-subtle)', borderRadius: 2, marginBottom: 10 }}/>
    <div style={{ height: 32, background: 'var(--surface-0)', borderRadius: 4, border: '1px solid var(--accent)', marginBottom: 8 }}/>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
      {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 14, background: 'var(--surface-0)', borderRadius: 3, border: '1px solid var(--hair)' }}/>)}
    </div>
  </div>;
  if (id === 7) return <div style={{ transform: 'scale(0.55)', transformOrigin: 'center' }}><IPhoneFrame width={120}><StreakApp screen="home" theme="default" scale={120/393}/></IPhoneFrame></div>;
  if (id === 12) return <div style={{ width: '85%' }}>
    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Ready to go live?</div>
    {[0,1,2].map(i => <div key={i} style={{ padding: '4px 0', display: 'flex', gap: 6, borderBottom: '1px solid var(--hair)' }}>
      <div style={{ width: 36, height: 6, background: 'var(--text-subtle)', borderRadius: 2 }}/>
      <div style={{ flex: 1, height: 6, background: 'var(--text-primary)', borderRadius: 2 }}/>
    </div>)}
  </div>;
  if (id === 14) return <div style={{ width: '85%' }}>
    {[0,1,2,3].map(i => <div key={i} style={{ padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: i < 2 ? 'var(--success)' : i === 2 ? 'var(--accent)' : 'var(--surface-2)' }}/>
      <div style={{ flex: 1, height: 5, background: i <= 2 ? 'var(--text-primary)' : 'var(--surface-2)', borderRadius: 2 }}/>
    </div>)}
  </div>;
  if (id === 15) return <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
    <div style={{ transform: 'scale(0.35)', transformOrigin: 'center' }}><IPhoneFrame width={120}><StreakApp screen="home" theme="default" scale={120/393}/></IPhoneFrame></div>
    <div style={{ width: 40, height: 40, background: '#fff', borderRadius: 4, padding: 3 }}><FakeQR/></div>
  </div>;
  return null;
};

Object.assign(window, { EmptyStateTemplate, ErrorStateTemplate, LoadingSkeletonTemplate, JourneyMap });
