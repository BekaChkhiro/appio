// Realistic iPhone 15 Pro frame — pure CSS/SVG, original
const IPhoneFrame = ({ children, width = 320, showHome = true, statusBarTime = '9:41', statusBarDark = false }) => {
  const scale = width / 393; // iPhone 15 Pro width is 393pt
  const height = 852 * scale;
  return (
    <div style={{
      width, height,
      position: 'relative',
      borderRadius: 56 * scale,
      padding: 4 * scale,
      background: 'linear-gradient(160deg, #3a3a42 0%, #1a1a1f 40%, #2a2a32 100%)',
      boxShadow: `0 ${30*scale}px ${60*scale}px -${20*scale}px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 ${2*scale}px rgba(0,0,0,0.8)`,
    }}>
      {/* Outer bezel ring */}
      <div style={{
        position: 'absolute', inset: 4 * scale,
        borderRadius: 52 * scale,
        background: '#0a0a0d',
        boxShadow: `inset 0 0 0 ${1.5*scale}px #2a2a30`,
      }} />
      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -1.5*scale, top: 180*scale, width: 3*scale, height: 28*scale, background: '#2a2a32', borderRadius: 2*scale }} />
      <div style={{ position: 'absolute', left: -1.5*scale, top: 240*scale, width: 3*scale, height: 50*scale, background: '#2a2a32', borderRadius: 2*scale }} />
      <div style={{ position: 'absolute', left: -1.5*scale, top: 310*scale, width: 3*scale, height: 50*scale, background: '#2a2a32', borderRadius: 2*scale }} />
      <div style={{ position: 'absolute', right: -1.5*scale, top: 260*scale, width: 3*scale, height: 80*scale, background: '#2a2a32', borderRadius: 2*scale }} />

      {/* Screen */}
      <div style={{
        position: 'absolute', inset: 10 * scale,
        borderRadius: 48 * scale,
        overflow: 'hidden',
        background: '#000',
      }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--surface-0)' }}>
          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 54*scale,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `0 ${28*scale}px 0 ${32*scale}px`,
            fontSize: 17*scale, fontWeight: 600, fontFamily: 'var(--f-ui)',
            color: statusBarDark ? '#000' : '#fff',
            zIndex: 20, pointerEvents: 'none',
          }}>
            <span style={{ fontFeatureSettings: "'tnum'" }}>{statusBarTime}</span>
            <span style={{ display: 'flex', gap: 5*scale, alignItems: 'center' }}>
              {/* Signal */}
              <svg width={17*scale} height={11*scale} viewBox="0 0 17 11" fill={statusBarDark ? '#000' : '#fff'}>
                <rect x="0" y="7" width="3" height="4" rx="0.5"/>
                <rect x="4.5" y="5" width="3" height="6" rx="0.5"/>
                <rect x="9" y="2.5" width="3" height="8.5" rx="0.5"/>
                <rect x="13.5" y="0" width="3" height="11" rx="0.5"/>
              </svg>
              {/* Wifi */}
              <svg width={16*scale} height={11*scale} viewBox="0 0 16 11" fill={statusBarDark ? '#000' : '#fff'}>
                <path d="M8 11 L10 8.7 A2.5 2.5 0 0 0 6 8.7 Z"/>
                <path d="M8 6.5 a5 5 0 0 1 3.5 1.5 l1.2 -1.4 a7 7 0 0 0 -9.4 0 l1.2 1.4 A5 5 0 0 1 8 6.5 Z"/>
                <path d="M8 3 a8.5 8.5 0 0 1 6 2.5 l1.3 -1.5 a10.5 10.5 0 0 0 -14.6 0 l1.3 1.5 A8.5 8.5 0 0 1 8 3 Z"/>
              </svg>
              {/* Battery */}
              <svg width={25*scale} height={11*scale} viewBox="0 0 25 11" fill="none">
                <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke={statusBarDark ? '#000' : '#fff'} opacity="0.4"/>
                <rect x="23" y="3.5" width="2" height="4" rx="1" fill={statusBarDark ? '#000' : '#fff'} opacity="0.4"/>
                <rect x="2" y="2" width="18" height="7" rx="1.5" fill={statusBarDark ? '#000' : '#fff'}/>
              </svg>
            </span>
          </div>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 11*scale, left: '50%', transform: 'translateX(-50%)',
            width: 124*scale, height: 37*scale,
            background: '#000',
            borderRadius: 20*scale,
            zIndex: 30,
          }} />
          {/* Content area */}
          <div style={{
            position: 'absolute', inset: 0,
            paddingTop: 54*scale, paddingBottom: showHome ? 34*scale : 0,
            overflow: 'hidden',
          }}>
            {children}
          </div>
          {/* Home indicator */}
          {showHome && (
            <div style={{
              position: 'absolute', bottom: 8*scale, left: '50%', transform: 'translateX(-50%)',
              width: 134*scale, height: 5*scale,
              background: statusBarDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
              borderRadius: 3*scale,
              zIndex: 20,
            }}/>
          )}
        </div>
      </div>
    </div>
  );
};

window.IPhoneFrame = IPhoneFrame;
