import { Fragment, type ReactNode } from "react";

/** Renders the inline markup of content strings: **bold**, *cited form*, [[marked]], ~~struck~~. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[\[.+?\]\]|~~[^~]+~~)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("[[") && p.endsWith("]]")) return <mark key={i}>{p.slice(2, -2)}</mark>;
        if (p.startsWith("~~") && p.endsWith("~~") && p.length > 4) return <del key={i}>{p.slice(2, -2)}</del>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/**
 * The Barcelona "panot" flower tile: four petals and a centre, one part per
 * lesson. `filled` parts are coloured; `fresh` is the part just completed, which grows in.
 */
export function Panot({ filled, total = 5, fresh, size = 44 }: { filled: number; total?: number; fresh?: number; size?: number }) {
  const parts = [
    { cx: 50, cy: 28, r: 13 },
    { cx: 72, cy: 50, r: 13 },
    { cx: 50, cy: 72, r: 13 },
    { cx: 28, cy: 50, r: 13 },
    { cx: 50, cy: 50, r: 7 },
  ].slice(0, total);
  return (
    <svg className="panot" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="3" y="3" width="94" height="94" rx="14" className="panot-tile" />
      {parts.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          className={`panot-part${i < filled ? " is-filled" : ""}${i === total - 1 ? " is-centre" : ""}${i === fresh ? " is-fresh" : ""}`}
        />
      ))}
    </svg>
  );
}

/**
 * An illustration that moves: animated WebP, or its still frame when the system
 * asks for reduced motion or when `animate` is off (e.g. a streak not yet kept today).
 */
export function Sprite({ anim, still, size, animate = true, className }: { anim: string; still: string; size: number; animate?: boolean; className?: string }) {
  return (
    <picture className={className}>
      {animate && <source srcSet={still} media="(prefers-reduced-motion: reduce)" />}
      <img src={animate ? anim : still} width={size} height={size} alt="" draggable={false} />
    </picture>
  );
}

const icons: Record<string, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  flag: <path d="M6 21V4m0 0h10l-2 4 2 4H6" />,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
};

export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
