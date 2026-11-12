"use client";
import Icon from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** Sun/moon switch. The icons cross-fade and rotate; the page itself transitions from the button (see lib/theme). */
export default function ThemeToggle({ className = "iconbtn" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { L } = useI18n();
  const label = theme === "dark" ? L(["الوضع الفاتح", "Light mode"]) : L(["الوضع الداكن", "Dark mode"]);
  return (
    <button type="button" className={`${className} theme-tg`} data-theme-now={theme} aria-label={label} title={label}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }}>
      <Icon name="sun" className="ico tg-sun" />
      <Icon name="moon" className="ico tg-moon" />
    </button>
  );
}
