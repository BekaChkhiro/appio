// Appio icon set — hairline strokes, 1.5px, 20x20 viewBox by default
// Original, not copied from any icon library.
const Icon = ({ name, size = 16, stroke = 'currentColor', strokeWidth = 1.5, fill = 'none', style }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {paths}
    </svg>
  );
};

const ICONS = {
  // Sparkle / AI
  sparkle: <>
    <path d="M10 3 L11.3 7.5 L15.8 9 L11.3 10.5 L10 15 L8.7 10.5 L4.2 9 L8.7 7.5 Z"/>
    <path d="M15.5 3.5 L16 5 L17.5 5.5 L16 6 L15.5 7.5 L15 6 L13.5 5.5 L15 5 Z"/>
  </>,
  // Chat bubble
  chat: <path d="M3.5 6.5 a3 3 0 0 1 3 -3 h7 a3 3 0 0 1 3 3 v4 a3 3 0 0 1 -3 3 h-3.5 l-3.5 3 v-3 h0 a3 3 0 0 1 -3 -3 z"/>,
  send: <>
    <path d="M17 3 L3 9 L9 11 L11 17 Z"/>
    <path d="M9 11 L17 3"/>
  </>,
  mic: <>
    <rect x="8" y="3" width="4" height="9" rx="2"/>
    <path d="M5 10 a5 5 0 0 0 10 0"/>
    <path d="M10 15 v3"/>
  </>,
  paperclip: <path d="M14.5 9 L8.5 15 a3 3 0 1 1 -4.2 -4.2 L11 4 a2 2 0 0 1 2.8 2.8 L7.5 13 a1 1 0 0 1 -1.4 -1.4 L12 6.5"/>,
  // Status
  check: <path d="M4 10 L8 14 L16 5"/>,
  x: <><path d="M5 5 L15 15"/><path d="M15 5 L5 15"/></>,
  alert: <>
    <path d="M10 3 L17 16 H3 Z"/>
    <path d="M10 8 V11"/>
    <circle cx="10" cy="13.5" r="0.5" fill="currentColor" stroke="none"/>
  </>,
  info: <><circle cx="10" cy="10" r="7"/><path d="M10 9 V14"/><circle cx="10" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></>,
  loader: <>
    <path d="M10 3 V6" opacity="1"/>
    <path d="M14.9 5.1 L12.8 7.2" opacity="0.85"/>
    <path d="M17 10 H14" opacity="0.7"/>
    <path d="M14.9 14.9 L12.8 12.8" opacity="0.55"/>
    <path d="M10 17 V14" opacity="0.4"/>
    <path d="M5.1 14.9 L7.2 12.8" opacity="0.3"/>
    <path d="M3 10 H6" opacity="0.2"/>
    <path d="M5.1 5.1 L7.2 7.2" opacity="0.15"/>
  </>,
  // Nav
  home: <>
    <path d="M3 9 L10 3 L17 9 V16 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 Z"/>
    <path d="M8 17 V11 H12 V17"/>
  </>,
  grid: <>
    <rect x="3" y="3" width="6" height="6" rx="1"/>
    <rect x="11" y="3" width="6" height="6" rx="1"/>
    <rect x="3" y="11" width="6" height="6" rx="1"/>
    <rect x="11" y="11" width="6" height="6" rx="1"/>
  </>,
  plus: <><path d="M10 4 V16"/><path d="M4 10 H16"/></>,
  minus: <path d="M4 10 H16"/>,
  search: <>
    <circle cx="9" cy="9" r="5"/>
    <path d="M13 13 L16.5 16.5"/>
  </>,
  settings: <>
    <circle cx="10" cy="10" r="2.5"/>
    <path d="M10 2 L10 4 M10 16 L10 18 M18 10 L16 10 M4 10 L2 10 M15.7 4.3 L14.2 5.8 M5.8 14.2 L4.3 15.7 M15.7 15.7 L14.2 14.2 M5.8 5.8 L4.3 4.3"/>
  </>,
  user: <>
    <circle cx="10" cy="7" r="3"/>
    <path d="M3 17 C4 13 7 12 10 12 C13 12 16 13 17 17"/>
  </>,
  bell: <>
    <path d="M5 14 V9 a5 5 0 0 1 10 0 V14 L16 15 H4 Z"/>
    <path d="M8.5 17.5 a1.5 1.5 0 0 0 3 0"/>
  </>,
  // Actions
  chevronDown: <path d="M5 8 L10 13 L15 8"/>,
  chevronRight: <path d="M8 5 L13 10 L8 15"/>,
  chevronLeft: <path d="M12 5 L7 10 L12 15"/>,
  chevronUp: <path d="M5 12 L10 7 L15 12"/>,
  more: <><circle cx="5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></>,
  moreV: <><circle cx="10" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="1" fill="currentColor" stroke="none"/></>,
  arrowRight: <><path d="M4 10 H16"/><path d="M12 6 L16 10 L12 14"/></>,
  arrowUp: <><path d="M10 16 V4"/><path d="M6 8 L10 4 L14 8"/></>,
  external: <><path d="M11 4 H16 V9"/><path d="M16 4 L9 11"/><path d="M13 16 H4 V7"/></>,
  refresh: <>
    <path d="M3 10 a7 7 0 0 1 12 -5 L17 7 M17 3 V7 H13"/>
    <path d="M17 10 a7 7 0 0 1 -12 5 L3 13 M3 17 V13 H7"/>
  </>,
  copy: <>
    <rect x="4" y="4" width="10" height="12" rx="2"/>
    <path d="M7 4 V2 h9 v12 h-2"/>
  </>,
  eye: <>
    <path d="M2 10 C4 6 7 4 10 4 C13 4 16 6 18 10 C16 14 13 16 10 16 C7 16 4 14 2 10 Z"/>
    <circle cx="10" cy="10" r="2.5"/>
  </>,
  trash: <>
    <path d="M4 6 H16"/>
    <path d="M6 6 V16 a1 1 0 0 0 1 1 H13 a1 1 0 0 0 1 -1 V6"/>
    <path d="M8 6 V4 a1 1 0 0 1 1 -1 H11 a1 1 0 0 1 1 1 V6"/>
  </>,
  download: <><path d="M10 3 V13"/><path d="M6 10 L10 14 L14 10"/><path d="M3 17 H17"/></>,
  share: <>
    <circle cx="5" cy="10" r="2"/>
    <circle cx="15" cy="5" r="2"/>
    <circle cx="15" cy="15" r="2"/>
    <path d="M7 9 L13 6"/>
    <path d="M7 11 L13 14"/>
  </>,
  // Builder
  screen: <>
    <rect x="4" y="3" width="12" height="14" rx="2"/>
    <path d="M4 6 H16"/>
    <circle cx="10" cy="15" r="0.5" fill="currentColor" stroke="none"/>
  </>,
  phone: <>
    <rect x="6" y="2" width="8" height="16" rx="2"/>
    <path d="M9 16 H11"/>
  </>,
  device: <>
    <rect x="3" y="4" width="10" height="8" rx="1"/>
    <rect x="14" y="7" width="4" height="10" rx="1"/>
  </>,
  code: <>
    <path d="M7 7 L3 10 L7 13"/>
    <path d="M13 7 L17 10 L13 13"/>
    <path d="M11 5 L9 15"/>
  </>,
  wand: <>
    <path d="M14 3 L17 6 L6 17 L3 14 Z"/>
    <path d="M11 6 L14 9"/>
    <path d="M16 12 L16.5 13.5 L18 14 L16.5 14.5 L16 16 L15.5 14.5 L14 14 L15.5 13.5 Z"/>
  </>,
  palette: <>
    <path d="M10 3 a7 7 0 1 0 0 14 c1 0 2 -1 2 -2 s-1 -1 -1 -2 s2 -1 3 -1 a3 3 0 0 0 3 -3 a7 7 0 0 0 -7 -6 Z"/>
    <circle cx="6.5" cy="9" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="9" cy="6" r="0.8" fill="currentColor" stroke="none"/>
    <circle cx="13" cy="7" r="0.8" fill="currentColor" stroke="none"/>
  </>,
  database: <>
    <ellipse cx="10" cy="5" rx="6" ry="2"/>
    <path d="M4 5 V10 C4 11 7 12 10 12 C13 12 16 11 16 10 V5"/>
    <path d="M4 10 V15 C4 16 7 17 10 17 C13 17 16 16 16 15 V10"/>
  </>,
  globe: <>
    <circle cx="10" cy="10" r="7"/>
    <path d="M3 10 H17"/>
    <path d="M10 3 C12 5 13 7 13 10 C13 13 12 15 10 17 C8 15 7 13 7 10 C7 7 8 5 10 3 Z"/>
  </>,
  lock: <>
    <rect x="4" y="9" width="12" height="8" rx="1.5"/>
    <path d="M6.5 9 V6 a3.5 3.5 0 0 1 7 0 V9"/>
  </>,
  unlock: <>
    <rect x="4" y="9" width="12" height="8" rx="1.5"/>
    <path d="M6.5 9 V6 a3.5 3.5 0 0 1 6.5 -1.5"/>
  </>,
  // Content
  flame: <path d="M10 17 c3 0 5 -2 5 -5 c0 -3 -2 -4 -3 -7 c-1 2 -3 3 -3 5 c0 -1 -1 -2 -2 -2 c0 2 -2 3 -2 5 c0 3 2 4 5 4 Z"/>,
  leaf: <>
    <path d="M4 16 C4 8 9 3 17 4 C17 12 12 17 4 16 Z"/>
    <path d="M4 16 L12 8"/>
  </>,
  book: <>
    <path d="M4 4 H9 a2 2 0 0 1 2 2 V17 a2 2 0 0 0 -2 -2 H4 Z"/>
    <path d="M16 4 H11 a2 2 0 0 0 -2 2 V17 a2 2 0 0 1 2 -2 H16 Z"/>
  </>,
  dumbbell: <>
    <rect x="2" y="8" width="2" height="4" rx="0.5"/>
    <rect x="4" y="6" width="3" height="8" rx="0.5"/>
    <path d="M7 10 H13"/>
    <rect x="13" y="6" width="3" height="8" rx="0.5"/>
    <rect x="16" y="8" width="2" height="4" rx="0.5"/>
  </>,
  link: <>
    <path d="M9 11 a3 3 0 0 0 4 0 L15 9 a3 3 0 0 0 -4 -4 L10 6"/>
    <path d="M11 9 a3 3 0 0 0 -4 0 L5 11 a3 3 0 0 0 4 4 L10 14"/>
  </>,
  calendar: <>
    <rect x="3" y="5" width="14" height="12" rx="1.5"/>
    <path d="M3 8 H17"/>
    <path d="M7 3 V6 M13 3 V6"/>
  </>,
  cake: <>
    <path d="M4 17 V11 H16 V17 Z"/>
    <path d="M4 11 C4 9 6 9 6 9 M8 11 C8 9 10 9 10 9 M12 11 C12 9 14 9 14 9 M16 11 C16 9 14 9 14 9"/>
    <path d="M10 9 V6"/>
    <path d="M10 5 C9.5 4.5 9.5 3.5 10 3 C10.5 3.5 10.5 4.5 10 5 Z" fill="currentColor" stroke="none"/>
  </>,
  coffee: <>
    <path d="M4 7 H14 V13 a3 3 0 0 1 -3 3 H7 a3 3 0 0 1 -3 -3 Z"/>
    <path d="M14 9 H15.5 a1.5 1.5 0 0 1 0 3 H14"/>
    <path d="M7 5 V3 M10 5 V3"/>
  </>,
  // Nav
  menu: <><path d="M3 6 H17"/><path d="M3 10 H17"/><path d="M3 14 H17"/></>,
  panel: <>
    <rect x="3" y="4" width="14" height="12" rx="1.5"/>
    <path d="M8 4 V16"/>
  </>,
  qr: <>
    <rect x="3" y="3" width="5" height="5"/>
    <rect x="12" y="3" width="5" height="5"/>
    <rect x="3" y="12" width="5" height="5"/>
    <path d="M5 5 H6 M5 14 H6 M14 5 H15"/>
    <path d="M11 11 H12 V12 M14 11 V13 M16 14 V16 H14 M11 14 V16 H12"/>
  </>,
  chart: <>
    <path d="M3 17 H17"/>
    <path d="M5 14 V10"/>
    <path d="M9 14 V6"/>
    <path d="M13 14 V11"/>
    <path d="M17 14 V4"/>
  </>,
  history: <>
    <path d="M3 10 a7 7 0 1 0 2 -5"/>
    <path d="M3 3 V7 H7"/>
    <path d="M10 6 V10 L13 12"/>
  </>,
  gauge: <>
    <path d="M3 14 a7 7 0 0 1 14 0"/>
    <path d="M10 14 L14 8"/>
    <circle cx="10" cy="14" r="1" fill="currentColor" stroke="none"/>
  </>,
  github: <path d="M10 2 C5.6 2 2 5.6 2 10 c0 3.5 2.3 6.5 5.5 7.6 c0.4 0.1 0.5 -0.2 0.5 -0.4 v-1.5 c-2.2 0.5 -2.7 -1 -2.7 -1 c-0.4 -0.9 -0.9 -1.1 -0.9 -1.1 c-0.7 -0.5 0.1 -0.5 0.1 -0.5 c0.8 0.1 1.2 0.8 1.2 0.8 c0.7 1.2 1.9 0.9 2.4 0.7 c0.1 -0.5 0.3 -0.9 0.5 -1.1 c-1.8 -0.2 -3.6 -0.9 -3.6 -4 c0 -0.9 0.3 -1.6 0.8 -2.1 c-0.1 -0.2 -0.4 -1 0.1 -2.1 c0 0 0.7 -0.2 2.2 0.8 c0.6 -0.2 1.3 -0.3 2 -0.3 c0.7 0 1.4 0.1 2 0.3 c1.5 -1 2.2 -0.8 2.2 -0.8 c0.4 1.1 0.2 1.9 0.1 2.1 c0.5 0.6 0.8 1.3 0.8 2.1 c0 3.1 -1.8 3.7 -3.6 3.9 c0.3 0.3 0.5 0.8 0.5 1.5 v2.3 c0 0.2 0.1 0.5 0.6 0.4 C15.7 16.5 18 13.5 18 10 C18 5.6 14.4 2 10 2 Z" fill="currentColor" stroke="none"/>,
  google: <>
    <path d="M17 10.2 c0 -0.6 -0.1 -1.2 -0.2 -1.7 H10 v3.3 h3.9 c -0.2 0.9 -0.7 1.7 -1.5 2.2 v1.8 h2.5 C16.3 14.4 17 12.5 17 10.2 Z" fill="#4285F4" stroke="none"/>
    <path d="M10 17 c2.1 0 3.8 -0.7 5.1 -1.9 l -2.5 -1.8 c -0.7 0.4 -1.5 0.7 -2.6 0.7 c -2 0 -3.7 -1.4 -4.3 -3.2 H3.1 v2 C4.4 15.5 7 17 10 17 Z" fill="#34A853" stroke="none"/>
    <path d="M5.7 10.8 c -0.1 -0.4 -0.2 -0.9 -0.2 -1.3 c0 -0.4 0.1 -0.9 0.2 -1.3 v-2 H3.1 c -0.5 1 -0.8 2.1 -0.8 3.3 c0 1.2 0.3 2.3 0.8 3.3 L5.7 10.8 Z" fill="#FBBC05" stroke="none"/>
    <path d="M10 5.8 c1.1 0 2.1 0.4 2.9 1.1 l2.2 -2.2 C13.8 3.5 12.1 2.8 10 2.8 C7 2.8 4.4 4.5 3.1 7 L5.7 9 C6.3 7.2 8 5.8 10 5.8 Z" fill="#EA4335" stroke="none"/>
  </>,
  convex: <>
    <path d="M10 3 L16 7 V13 L10 17 L4 13 V7 Z"/>
    <path d="M10 3 V17"/>
    <path d="M4 7 L16 13"/>
    <path d="M16 7 L4 13"/>
  </>,
  // Dot
  dot: <circle cx="10" cy="10" r="3" fill="currentColor" stroke="none"/>,
};

window.Icon = Icon;
