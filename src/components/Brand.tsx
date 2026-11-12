import { Link } from "@tanstack/react-router";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 160 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="var(--ask)" />
      <circle cx="110" cy="50" r="48" fill="var(--say)" opacity="0.92" />
    </svg>
  );
}

function EarIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 19.5 8 20 8 18" />
      <path d="M10 9a2 2 0 1 1 4 0c0 1.5-2 2-2 3.5" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

export function AppHeader({
  voiceName,
  voiceFailed,
  voiceLabel = "Voix",
  unavailableLabel,
}: {
  voiceName?: string | null;
  voiceFailed?: boolean;
  voiceLabel?: string;
  unavailableLabel?: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] px-5 py-4 sm:px-8">
      <Link to="/dire" className="flex min-h-[44px] items-center gap-3">
        <Logo size={52} />
        <span className="font-display text-[24px] sm:text-[28px]">Invincible Voice</span>
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {voiceName ? (
          <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full border-2 px-4 text-[14px]" style={{ background: "var(--white)" }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2E9E4F" }} />
            {voiceLabel} : {voiceName}
          </span>
        ) : voiceFailed ? (
          <span className="inline-flex min-h-[36px] items-center rounded-full border-2 px-4 text-[14px]" style={{ color: "var(--muted)" }}>
            {unavailableLabel}
          </span>
        ) : null}
        <Link to="/guide" className="btn btn-secondary">Guide</Link>
        <Link to="/parametres" className="btn btn-secondary">Paramètres</Link>
      </div>
    </header>
  );
}

export function ModeTabs({ active }: { active: "ask" | "dire" }) {
  const base = "flex min-h-[72px] flex-1 items-center gap-3 px-5 text-[20px] sm:px-8 sm:text-[26px] font-display";
  const ask = active === "ask";
  return (
    <nav className="flex w-full" aria-label="Modes">
      <Link
        to="/ask"
        className={base}
        aria-current={ask ? "page" : undefined}
        style={ask
          ? { background: "var(--ask)", color: "var(--white)", borderBottom: "3px solid var(--ask)" }
          : { background: "var(--paper)", color: "var(--ask)", borderBottom: "3px solid var(--ink)" }}
      >
        <EarIcon /> Demandez-moi
      </Link>
      <Link
        to="/dire"
        className={`${base} justify-end text-right`}
        aria-current={!ask ? "page" : undefined}
        style={!ask
          ? { background: "var(--say)", color: "var(--ink)", borderBottom: "3px solid var(--say)" }
          : { background: "var(--paper)", color: "var(--say)", borderBottom: "3px solid var(--ink)" }}
      >
        Je veux te dire <BubbleIcon />
      </Link>
    </nav>
  );
}

export function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border-2 p-1" role="group">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="min-h-[40px] rounded-full px-4 text-[15px] font-medium transition-colors"
            style={{ background: active ? "var(--ink)" : "transparent", color: active ? "var(--paper)" : "var(--ink)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
