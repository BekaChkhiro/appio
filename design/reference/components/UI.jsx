// Shared UI primitives for Appio

const Button = ({ variant = 'primary', size = 'md', loading = false, disabled = false, icon, trailingIcon, children, onClick, style, full = false, as = 'button', ...rest }) => {
  const sizes = {
    sm: { padY: 6, padX: 10, font: 12, iconSize: 14, gap: 6, r: 6, h: 28 },
    md: { padY: 8, padX: 14, font: 14, iconSize: 16, gap: 8, r: 8, h: 36 },
    lg: { padY: 12, padX: 20, font: 15, iconSize: 18, gap: 10, r: 10, h: 44 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: 'var(--accent)', color: '#fff', border: '1px solid transparent',
      hoverBg: 'var(--accent-hover)', shadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 6px 14px -4px rgba(124,92,255,0.5)' },
    secondary: { bg: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--strong)',
      hoverBg: 'var(--surface-3)', shadow: 'none' },
    ghost: { bg: 'transparent', color: 'var(--text-primary)', border: '1px solid transparent',
      hoverBg: 'var(--surface-2)', shadow: 'none' },
    destructive: { bg: 'var(--danger)', color: '#fff', border: '1px solid transparent',
      hoverBg: '#ff5570', shadow: 'none' },
    outline: { bg: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--strong)',
      hoverBg: 'var(--surface-2)', shadow: 'none' },
  };
  const v = variants[variant];
  const Comp = as;
  return (
    <Comp
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap,
        padding: `${s.padY}px ${s.padX}px`,
        height: s.h,
        fontSize: s.font, fontWeight: 500,
        background: v.bg, color: v.color, border: v.border,
        borderRadius: s.r,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--t-fast) var(--ease-out), transform var(--t-fast)',
        width: full ? '100%' : 'auto',
        boxShadow: v.shadow,
        fontFamily: 'var(--f-ui)',
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => !disabled && !loading && (e.currentTarget.style.background = v.hoverBg)}
      onMouseLeave={e => !disabled && !loading && (e.currentTarget.style.background = v.bg)}
      {...rest}
    >
      {loading ? (
        <svg width={s.iconSize} height={s.iconSize} viewBox="0 0 20 20" style={{ animation: 'spin 0.8s linear infinite' }}>
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path d="M10 3 a7 7 0 0 1 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : icon ? <Icon name={icon} size={s.iconSize} /> : null}
      {children}
      {trailingIcon && !loading && <Icon name={trailingIcon} size={s.iconSize} />}
    </Comp>
  );
};

const Chip = ({ variant = 'idle', children, icon, size = 'sm', style }) => {
  const variants = {
    idle:     { bg: 'var(--surface-2)', fg: 'var(--text-muted)', dot: 'var(--text-subtle)' },
    thinking: { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', dot: 'var(--accent)' },
    writing:  { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', dot: 'var(--accent)' },
    ready:    { bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
    error:    { bg: 'var(--danger-soft)', fg: 'var(--danger)', dot: 'var(--danger)' },
    warning:  { bg: 'var(--warning-soft)', fg: 'var(--warning)', dot: 'var(--warning)' },
    draft:    { bg: 'var(--surface-2)', fg: 'var(--text-muted)', dot: 'var(--text-muted)' },
    published:{ bg: 'var(--success-soft)', fg: 'var(--success)', dot: 'var(--success)' },
    neutral:  { bg: 'var(--surface-2)', fg: 'var(--text-primary)', dot: 'var(--text-muted)' },
  };
  const v = variants[variant];
  const pulse = variant === 'thinking' || variant === 'writing';
  const sizes = { sm: { h: 22, padX: 8, font: 11 }, md: { h: 28, padX: 10, font: 12 } };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: v.bg, color: v.fg,
      padding: `0 ${s.padX}px`, height: s.h,
      borderRadius: 'var(--r-pill)',
      fontSize: s.font, fontWeight: 600,
      letterSpacing: '-0.005em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon ? (
        <Icon name={icon} size={12} />
      ) : (
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: v.dot,
          animation: pulse ? 'pulseDot 1.4s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}/>
      )}
      {children}
    </span>
  );
};

const Input = ({ icon, placeholder, value, onChange, type = 'text', full = true, style }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center',
    background: 'var(--surface-1)',
    border: '1px solid var(--hair)',
    borderRadius: 'var(--r-input)',
    padding: '0 10px', height: 36,
    gap: 8,
    width: full ? '100%' : 'auto',
    transition: 'border-color var(--t-fast)',
    ...style,
  }}
  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
  onBlur={e => e.currentTarget.style.borderColor = 'var(--hair)'}
  >
    {icon && <Icon name={icon} size={14} stroke="var(--text-muted)" />}
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      style={{
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        color: 'var(--text-primary)', fontSize: 14,
        fontFamily: 'var(--f-ui)',
      }}
    />
  </div>
);

const Toggle = ({ on, onChange, size = 'md' }) => {
  const sizes = { sm: { w: 28, h: 16, knob: 12 }, md: { w: 36, h: 20, knob: 16 } };
  const s = sizes[size];
  return (
    <div onClick={() => onChange && onChange(!on)} style={{
      width: s.w, height: s.h,
      borderRadius: s.h / 2,
      background: on ? 'var(--accent)' : 'var(--surface-3)',
      padding: 2,
      cursor: 'pointer',
      transition: 'background var(--t-base) var(--ease-out)',
      flexShrink: 0,
    }}>
      <div style={{
        width: s.knob, height: s.knob, borderRadius: '50%',
        background: '#fff',
        transform: on ? `translateX(${s.w - s.knob - 4}px)` : 'translateX(0)',
        transition: 'transform var(--t-base) var(--ease-out)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}/>
    </div>
  );
};

const Checkbox = ({ checked, onChange, label }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onChange && onChange(!checked)}>
    <div style={{
      width: 16, height: 16, borderRadius: 4,
      background: checked ? 'var(--accent)' : 'transparent',
      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--strong)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all var(--t-fast)',
    }}>
      {checked && <Icon name="check" size={12} stroke="#fff" strokeWidth={2.5} />}
    </div>
    {label && <span style={{ fontSize: 14 }}>{label}</span>}
  </label>
);

const Card = ({ children, padding = 16, style, hover = false, onClick }) => (
  <div onClick={onClick} style={{
    background: 'var(--surface-1)',
    border: '1px solid var(--hair)',
    borderRadius: 'var(--r-card)',
    padding,
    transition: 'background var(--t-fast), border-color var(--t-fast)',
    cursor: hover ? 'pointer' : 'default',
    ...style,
  }}
  onMouseEnter={hover ? e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--strong)'; } : undefined}
  onMouseLeave={hover ? e => { e.currentTarget.style.background = 'var(--surface-1)'; e.currentTarget.style.borderColor = 'var(--hair)'; } : undefined}
  >
    {children}
  </div>
);

const Divider = ({ vertical = false, style }) => (
  <div style={{
    [vertical ? 'width' : 'height']: 1,
    [vertical ? 'height' : 'width']: '100%',
    background: 'var(--hair)',
    flexShrink: 0,
    ...style,
  }}/>
);

// Chat message components
const UserMessage = ({ children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
    <div style={{
      maxWidth: '85%',
      background: 'var(--surface-2)',
      border: '1px solid var(--hair)',
      color: 'var(--text-primary)',
      padding: '10px 14px',
      borderRadius: 14,
      borderBottomRightRadius: 4,
      fontSize: 14, lineHeight: 1.55,
    }}>{children}</div>
  </div>
);

const AssistantMessage = ({ children, streaming }) => (
  <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
    {children}
    {streaming && <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent)', marginLeft: 2, animation: 'streamBlink 0.9s infinite', verticalAlign: 'middle' }}/>}
  </div>
);

// Diff card
const DiffCard = ({ kind = 'added', title, files, expanded, onToggle, animate }) => {
  const kinds = {
    added:    { icon: 'plus',  fg: 'var(--success)', bg: 'var(--success-soft)' },
    changed:  { icon: 'wand',  fg: 'var(--accent)',  bg: 'var(--accent-soft)'   },
    removed:  { icon: 'minus', fg: 'var(--danger)',  bg: 'var(--danger-soft)'   },
  };
  const k = kinds[kind];
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--hair)',
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
      animation: animate ? 'diffIn 220ms var(--ease-out)' : 'none',
    }}>
      <div onClick={onToggle} style={{
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: onToggle ? 'pointer' : 'default',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: k.bg, color: k.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}><Icon name={k.icon} size={14} strokeWidth={2}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {Array.isArray(files) ? `${files.length} files changed` : files}
          </div>
        </div>
        {onToggle && <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} stroke="var(--text-muted)" />}
      </div>
      {expanded && files && Array.isArray(files) && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--hair)', marginTop: 0 }}>
          {files.map(f => (
            <div key={f} style={{ padding: '6px 0', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: k.fg }}>+</span>{f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Toast
const Toast = ({ children, variant = 'info', icon }) => {
  const v = {
    info: { bg: 'var(--surface-2)', fg: 'var(--text-primary)', iconColor: 'var(--accent)' },
    success: { bg: 'var(--surface-2)', fg: 'var(--text-primary)', iconColor: 'var(--success)' },
    error: { bg: 'var(--surface-2)', fg: 'var(--text-primary)', iconColor: 'var(--danger)' },
  }[variant];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      background: v.bg, color: v.fg,
      padding: '10px 14px',
      border: '1px solid var(--strong)',
      borderRadius: 10,
      boxShadow: '0 20px 40px -20px rgba(0,0,0,0.5)',
      fontSize: 13,
    }}>
      {icon && <Icon name={icon} size={16} stroke={v.iconColor} />}
      {children}
    </div>
  );
};

Object.assign(window, { Button, Chip, Input, Toggle, Checkbox, Card, Divider, UserMessage, AssistantMessage, DiffCard, Toast });
