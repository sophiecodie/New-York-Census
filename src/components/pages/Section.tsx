import type { ReactNode } from "react";

export default function Section({ kicker, title, dek, children, dark }: { kicker?: string; title: string; dek?: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <section className={`block ${dark ? "block-dark" : ""}`}>
      <header className="block-head">
        {kicker && <div className="block-kicker">{kicker}</div>}
        <h2>{title}</h2>
        {dek && <p className="dek">{dek}</p>}
      </header>
      {children}
    </section>
  );
}
