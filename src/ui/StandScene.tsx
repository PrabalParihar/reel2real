export function StandScene({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "stand-scene is-compact" : "stand-scene"} viewBox="0 0 360 480" role="img" aria-label="Illustrated stand preview">
      <defs>
        <radialGradient id="light" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#3a342c" />
          <stop offset="70%" stopColor="#16140f" />
          <stop offset="100%" stopColor="#0c0d11" />
        </radialGradient>
        <linearGradient id="board" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5a4636" />
          <stop offset="100%" stopColor="#2c2118" />
        </linearGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d7278" />
          <stop offset="100%" stopColor="#2e3338" />
        </linearGradient>
      </defs>
      <rect width="360" height="480" fill="url(#light)" />
      <ellipse cx="180" cy="250" rx="150" ry="28" fill="#000" opacity="0.35" />
      <rect x="48" y="168" width="264" height="196" rx="28" fill="url(#board)" />
      <rect x="64" y="184" width="232" height="164" rx="20" fill="#000" opacity="0.18" />
      <ellipse cx="150" cy="268" rx="54" ry="28" fill="url(#stone)" />
      <ellipse cx="150" cy="260" rx="36" ry="16" fill="#1a1d20" />
      <rect x="176" y="188" width="16" height="92" rx="8" transform="rotate(28 184 230)" fill="url(#stone)" />
      <ellipse cx="112" cy="312" rx="22" ry="12" fill="#c47a3a" />
      <ellipse cx="210" cy="300" rx="10" ry="6" fill="#1f6b45" />
      <ellipse cx="226" cy="308" rx="8" ry="5" fill="#1a5c3c" />
      <path d="M262 214h36c8 0 14 10 14 22v40c0 16-12 28-28 28h-8c-10 0-16-8-16-16v-18h-8v-12h10v-44z" fill="#d7dde6" />
      <path d="M270 226h20c4 0 8 6 8 12v28c0 8-6 14-14 14h-6v-54z" fill="#9aa3b2" opacity="0.45" />
      <path d="M298 236c14 2 22 14 20 28" fill="none" stroke="#d7dde6" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
