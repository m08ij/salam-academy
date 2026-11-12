/** Small inline stroke icon set (24×24 grid). No external icon library, so the strict CSP stays intact. */
const P: Record<string, React.ReactNode> = {
  learn: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c2 1.6 4 2.3 6 2.3s4-.7 6-2.3v-5" /><path d="M22 9v5" /></>,
  values: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" /></>,
  plan: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  trainer: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" /><path d="M16 4.5a3.2 3.2 0 010 6.3M18 14.8c1.8.7 3 2.5 3.3 5.2" /></>,
  users: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" /></>,
  enroll: <><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  programs: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  cohorts: <><path d="M4 8.5l8-4.5 8 4.5" /><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 20h17" /></>,
  audit: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12l2.2 2.2 4.2-4.4" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  account: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3.2" /><path d="M6.3 18.4c1.3-2.2 3.3-3.4 5.7-3.4s4.4 1.2 5.7 3.4" /></>,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  logout: <><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  play: <><path d="M7 4.5v15l13-7.5z" /></>,
  moon: <><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></>,
  heart: <><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  people: <><circle cx="8" cy="9" r="2.8" /><circle cx="16" cy="9" r="2.8" /><path d="M2.8 19c.5-2.8 2.6-4.5 5.2-4.5s4.7 1.7 5.2 4.5M10.8 19c.5-2.8 2.6-4.5 5.2-4.5s4.7 1.7 5.2 4.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" /></>,
  quiz: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2v.1" /></>,
  star: <><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></>,
  medal: <><circle cx="12" cy="14.5" r="5.5" /><path d="M8.5 9.8L6 3h4l2 4.2L14 3h4l-2.5 6.8" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
};

export type IconName = keyof typeof P;

export default function Icon({ name, className = "ico", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      {P[name]}
    </svg>
  );
}
