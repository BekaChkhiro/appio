// Group E — Post-publish: analytics, version history, app settings

const AnalyticsScreen = () => {
  const daysData = [18,22,19,24,28,31,29,27,32,35,38,36,34,39,42,40,44,48,46,49,52,55,58,54,60,63,61,65,68,72];
  const max = Math.max(...daysData);
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <AppSubNav active="Analytics"/>
      <div style={{ padding: '48px 64px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <div className="t-overline" style={{ marginBottom: 8 }}>Last 30 days</div>
            <div className="t-display">Streak in numbers.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm">Last 30 days</Button>
            <Button variant="ghost" size="sm" icon="download">Export</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Daily active', value: '1,248', delta: '+18%', up: true },
            { label: 'Total users',  value: '4,820', delta: '+142',  up: true },
            { label: 'Sessions',     value: '18.4k', delta: '+7%',   up: true, rhythm: true },
            { label: 'Error rate',   value: '0.12%', delta: '-0.04%', up: true },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 20 }}>
              <div className="t-caption" style={{ marginBottom: 8 }}>{s.label}</div>
              <div className="t-display" style={{ fontSize: 32, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.rhythm ? 'var(--rhythm)' : s.up ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="arrowUp" size={12} strokeWidth={2}/>{s.delta}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div className="t-h3">Daily active users</div>
              <div className="t-caption" style={{ marginTop: 4 }}>30-day trailing · trending up</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <LegendItem color="var(--accent)" label="This period"/>
              <LegendItem color="var(--text-subtle)" label="Previous period"/>
            </div>
          </div>
          <div style={{ height: 240, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '10px 0', borderBottom: '1px solid var(--hair)' }}>
            {daysData.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, position: 'relative' }}>
                <div style={{ width: '100%', height: `${(v / max) * 220}px`, background: 'var(--accent)', borderRadius: 2, opacity: 0.9 }}/>
                <div style={{ position: 'absolute', bottom: 3, left: 0, right: 0, height: `${((v - 5 - Math.sin(i/3)*3) / max) * 220}px`, background: 'var(--text-subtle)', opacity: 0.3, borderRadius: 2 }}/>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-muted)' }}>
            <span>Mar 23</span><span>Apr 01</span><span>Apr 08</span><span>Apr 15</span><span>Apr 22</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 24 }}>
            <div className="t-h3" style={{ marginBottom: 20 }}>Top screens</div>
            {[
              { name: 'Home', views: '42,108', pct: 100 },
              { name: 'Habit detail', views: '18,940', pct: 45 },
              { name: 'Stats', views: '9,220', pct: 22 },
              { name: 'Add habit', views: '3,480', pct: 8 },
              { name: 'You', views: '2,104', pct: 5 },
            ].map(s => (
              <div key={s.name} style={{ padding: '10px 0', borderBottom: '1px solid var(--hair)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                  <span className="t-mono-sm muted">{s.views}</span>
                </div>
                <div style={{ height: 4, background: 'var(--hair)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: 'var(--accent)' }}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 24 }}>
            <div className="t-h3" style={{ marginBottom: 20 }}>Errors</div>
            {[
              { msg: 'Network timeout · /api/habits', count: 12, when: '2h ago' },
              { msg: 'TypeError on Home render', count: 3, when: 'Yesterday' },
              { msg: 'Auth token expired', count: 24, when: '3d ago' },
            ].map(e => (
              <div key={e.msg} style={{ padding: '12px 0', borderBottom: '1px solid var(--hair)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-mono-sm" style={{ color: 'var(--text-primary)' }}>{e.msg}</div>
                  <div className="t-caption" style={{ marginTop: 2 }}>{e.when}</div>
                </div>
                <span className="t-mono-sm muted">{e.count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const LegendItem = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
    <span className="t-caption">{label}</span>
  </div>
);

const AppSubNav = ({ active }) => (
  <>
    <TopNav active="Projects"/>
    <div style={{ padding: '0 32px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--hair)', background: 'var(--surface-0)' }}>
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="chevronLeft" size={14} stroke="var(--text-muted)" style={{ cursor: 'pointer' }}/>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Streak</span>
        <Chip variant="published">Published</Chip>
      </div>
      <div style={{ marginLeft: 24, display: 'flex' }}>
        {['Builder','Analytics','Versions','Settings'].map(t => (
          <div key={t} style={{
            padding: '12px 14px', fontSize: 13, fontWeight: 500,
            color: active === t ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: active === t ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer',
          }}>{t}</div>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, padding: '8px 0' }}>
        <Button variant="ghost" size="sm" icon="external">Open app</Button>
      </div>
    </div>
  </>
);

// ---------- Version history ----------
const VersionsScreen = () => {
  const versions = [
    { v: 'v0.14', when: 'Just now', label: 'live', summary: 'Softened habit card corners · added rotation · theme tweaks', files: 3, author: 'Assistant', userAsk: 'make the habit cards more playful' },
    { v: 'v0.13', when: '2h ago', summary: 'Added Stats screen with 30-day bar chart', files: 4, author: 'Assistant', userAsk: 'add a stats screen' },
    { v: 'v0.12', when: 'Yesterday', summary: 'Changed accent from teal to violet', files: 1, author: 'Assistant', userAsk: 'try a violet accent' },
    { v: 'v0.11', when: 'Apr 20', summary: 'Initial Streak build · 4 habits · tab nav', files: 8, author: 'Assistant', userAsk: 'build a simple habit tracker' },
  ];
  return (
    <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
      <AppSubNav active="Versions"/>
      <div style={{ padding: '48px 64px', maxWidth: 1000, margin: '0 auto' }}>
        <div className="t-overline" style={{ marginBottom: 8 }}>History</div>
        <div className="t-display" style={{ marginBottom: 40 }}>Every version, one click away.</div>

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 8, top: 16, bottom: 16, width: 1, background: 'var(--hair)' }}/>
          {versions.map((v, i) => (
            <div key={v.v} style={{ display: 'flex', gap: 24, paddingBottom: 32, position: 'relative' }}>
              <div style={{ position: 'relative', width: 17, paddingTop: 18 }}>
                <div style={{ width: 17, height: 17, borderRadius: '50%', border: `2px solid ${i === 0 ? 'var(--accent)' : 'var(--text-subtle)'}`, background: i === 0 ? 'var(--accent)' : 'var(--surface-0)', position: 'relative', zIndex: 1 }}/>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="t-mono" style={{ color: 'var(--text-primary)' }}>{v.v}</span>
                  {v.label === 'live' && <Chip variant="published">Live</Chip>}
                  <span className="t-caption" style={{ marginLeft: 'auto' }}>{v.when}</span>
                </div>
                <div className="t-h4" style={{ marginBottom: 6 }}>{v.summary}</div>
                <div className="t-caption" style={{ fontStyle: 'italic' }}>"{v.userAsk}"</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hair)' }}>
                  <span className="t-mono-sm muted">{v.files} files changed</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Button variant="ghost" size="sm" icon="eye">Preview</Button>
                    {i > 0 && <Button variant="secondary" size="sm" icon="refresh">Restore</Button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- App settings ----------
const AppSettingsScreen = () => (
  <div className="scroll" style={{ height: '100%', overflow: 'auto', background: 'var(--surface-0)' }}>
    <AppSubNav active="Settings"/>
    <div style={{ padding: '48px 64px', maxWidth: 720, margin: '0 auto' }}>
      <div className="t-display" style={{ marginBottom: 40 }}>App settings</div>

      <SettingGroup label="General">
        <SettingRow label="Name"><Input value="Streak" style={{ maxWidth: 260 }}/></SettingRow>
        <SettingRow label="Icon">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Icon name="flame" size={22}/>
            </div>
            <Button variant="secondary" size="sm">Change</Button>
          </div>
        </SettingRow>
        <SettingRow label="Description">
          <Input value="A quiet habit tracker" style={{ maxWidth: 320 }}/>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="Domain">
        <SettingRow label="Appio URL">
          <span className="t-mono" style={{ color: 'var(--text-primary)' }}>streak-clara.appio.app</span>
        </SettingRow>
        <SettingRow label="Custom domain">
          <div>
            <Button variant="secondary" size="sm" disabled>Add custom domain</Button>
            <div className="t-caption" style={{ marginTop: 6 }}>Coming soon · Creator plan and up</div>
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label="Data">
        <SettingRow label="Convex project">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="convex" size={14} stroke="var(--accent)"/>
            <span className="t-mono">streak-prod-4f2a</span>
            <Chip variant="ready" style={{ marginLeft: 8 }}>Connected</Chip>
          </div>
        </SettingRow>
        <SettingRow label="Export code">
          <Button variant="secondary" size="sm" icon="github">Push to GitHub</Button>
        </SettingRow>
      </SettingGroup>

      <div style={{ marginTop: 40, padding: 24, border: '1px solid rgba(244,63,94,0.24)', borderRadius: 10, background: 'var(--danger-soft)' }}>
        <div className="t-h3" style={{ color: 'var(--danger)', marginBottom: 6 }}>Danger zone</div>
        <div className="t-caption" style={{ marginBottom: 20, color: 'var(--text-muted)' }}>These actions can't be undone.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Unpublish app</div>
            <div className="t-caption">Takes the URL offline · Data stays in your Convex.</div>
          </div>
          <Button variant="outline" size="sm">Unpublish</Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid rgba(244,63,94,0.2)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Delete app</div>
            <div className="t-caption">Removes from Appio · You decide about Convex data.</div>
          </div>
          <Button variant="destructive" size="sm" icon="trash">Delete</Button>
        </div>
      </div>
    </div>
  </div>
);

const SettingGroup = ({ label, children }) => (
  <div style={{ marginBottom: 32 }}>
    <div className="t-overline" style={{ marginBottom: 12 }}>{label}</div>
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--hair)', borderRadius: 10 }}>{children}</div>
  </div>
);

const SettingRow = ({ label, children }) => (
  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--hair)' }}>
    <div style={{ width: 140, fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</div>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

Object.assign(window, { AnalyticsScreen, VersionsScreen, AppSettingsScreen });
