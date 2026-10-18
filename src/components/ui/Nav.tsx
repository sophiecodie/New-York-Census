"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINES, A_LINE } from "@/content/lines";
import Bullet from "./Bullet";

const ITEMS = [
  { href: "/", label: "System Map" },
  ...LINES.map((l) => ({ href: `/${l.slug}`, label: l.topic, line: l })),
  { href: `/${A_LINE.slug}`, label: A_LINE.topic, line: A_LINE },
  { href: "/methods", label: "Data & Methods" },
];

export default function Nav() {
  const path = usePathname() || "/";
  const dark = path.startsWith("/immigration");
  return (
    <header className={`nav ${dark ? "nav-dark" : ""}`}>
      <Link href="/" className="nav-brand" aria-label="Home">
        <span className="brand-dots" aria-hidden>
          {[...LINES, A_LINE].map((l) => (
            <i key={l.id} style={{ background: l.color }} />
          ))}
        </span>
        <span>The New York Census Line</span>
      </Link>
      <nav aria-label="Lines">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} className={`nav-link ${active ? "active" : ""}`}>
              {"line" in it && it.line ? <Bullet id={it.line.id} color={it.line.color} ink={it.line.ink} size={20} /> : null}
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <span className="nav-meta">NEW YORK CITY · 5 BOROUGHS</span>
    </header>
  );
}
