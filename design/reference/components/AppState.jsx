// Global state: toasts + modals + command palette
// Usage: const { toast, openModal, closeModal } = useApp();

const AppContext = React.createContext(null);
const useApp = () => React.useContext(AppContext) || {
  toast: () => {},
  openModal: () => {},
  closeModal: () => {},
  navigate: () => {},
  openCommand: () => {},
};

let toastId = 0;

const AppProvider = ({ children, navigate }) => {
  const [toasts, setToasts] = React.useState([]);
  const [modal, setModal] = React.useState(null); // { key, props }
  const [cmdOpen, setCmdOpen] = React.useState(false);

  const toast = React.useCallback((message, opts = {}) => {
    const id = ++toastId;
    const variant = opts.variant || 'info';
    const action = opts.action; // { label, onClick }
    setToasts(t => [...t, { id, message, variant, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts.duration || 3200);
  }, []);

  const openModal = React.useCallback((key, props = {}) => {
    setModal({ key, props });
  }, []);
  const closeModal = React.useCallback(() => setModal(null), []);

  const openCommand = React.useCallback(() => setCmdOpen(true), []);
  const closeCommand = React.useCallback(() => setCmdOpen(false), []);

  // ⌘K globally + ? for shortcuts + Esc for modal
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
      if (e.key === '?' && !modal && !cmdOpen && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openModal('shortcuts');
      }
      if (e.key === 'Escape') {
        if (modal) setModal(null);
        else if (cmdOpen) setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, cmdOpen, openModal]);

  return (
    <AppContext.Provider value={{ toast, openModal, closeModal, openCommand, closeCommand, navigate: navigate || (() => {}) }}>
      {children}

      {/* Toast stack — bottom right */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 500,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => <ToastItem key={t.id} {...t} onAction={t.action?.onClick} />)}
      </div>

      {/* Modal container */}
      {modal && <ModalRoot modal={modal} onClose={closeModal} />}

      {/* Command palette */}
      {cmdOpen && <CommandPalette onClose={closeCommand} />}
    </AppContext.Provider>
  );
};

const ToastItem = ({ message, variant, action, onAction }) => {
  const colors = {
    info:    { border: 'var(--accent)',  icon: 'info',    fg: 'var(--accent)' },
    success: { border: 'var(--success)', icon: 'check',   fg: 'var(--success)' },
    warning: { border: 'var(--warning)', icon: 'alert',   fg: 'var(--warning)' },
    danger:  { border: 'var(--danger)',  icon: 'alert',   fg: 'var(--danger)' },
  }[variant] || { border: 'var(--accent)', icon: 'info', fg: 'var(--accent)' };
  return (
    <div style={{
      minWidth: 260, maxWidth: 420,
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface-1)',
      borderLeft: `3px solid ${colors.border}`,
      border: '1px solid var(--strong)',
      borderRadius: 'var(--r-card)',
      padding: '12px 14px',
      boxShadow: '0 12px 32px -10px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05) inset',
      animation: 'toastSlideIn 260ms var(--ease-out)',
      pointerEvents: 'auto',
      fontSize: 13, color: 'var(--text-primary)',
    }}>
      <Icon name={colors.icon} size={16} stroke={colors.fg}/>
      <div style={{ flex: 1 }}>{message}</div>
      {action && (
        <span onClick={onAction} style={{ fontSize: 12, color: colors.fg, cursor: 'pointer', fontWeight: 600, padding: '2px 6px' }}>
          {action.label}
        </span>
      )}
    </div>
  );
};

// Shared modal chrome
const ModalShell = ({ onClose, width = 520, children, backdropClose = true }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
    animation: 'fadeIn 160ms var(--ease-out)',
  }} onClick={backdropClose ? onClose : undefined}>
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
      background: 'var(--surface-1)',
      border: '1px solid var(--strong)',
      borderRadius: 'var(--r-modal)',
      boxShadow: 'var(--shadow-modal)',
      animation: 'modalIn 220ms var(--ease-out)',
    }}>
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, subtitle, onClose, icon, iconColor }) => (
  <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid var(--hair)' }}>
    {icon && (
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: iconColor || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18}/>
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
      {subtitle && <div className="t-caption" style={{ marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
    </div>
    <Icon name="x" size={18} stroke="var(--text-muted)" style={{ cursor: 'pointer', flexShrink: 0, marginTop: 4 }} onClick={onClose}/>
  </div>
);

const ModalBody = ({ children, style }) => (
  <div style={{ padding: '20px 24px', ...style }}>{children}</div>
);

const ModalFooter = ({ children }) => (
  <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--hair)' }}>{children}</div>
);

// Style injection for modal + toast keyframes
if (typeof document !== 'undefined' && !document.getElementById('__appio_anim_css')) {
  const s = document.createElement('style');
  s.id = '__appio_anim_css';
  s.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes modalIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes toastSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { AppContext, useApp, AppProvider, ModalShell, ModalHeader, ModalBody, ModalFooter, ToastItem });
