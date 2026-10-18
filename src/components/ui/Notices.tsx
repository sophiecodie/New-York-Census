export type Finding = { stat: string; title: string; body: string; source?: string };

/** Findings styled as MTA service notices. */
export default function Notices({ items, color, ink }: { items: Finding[]; color: string; ink: string }) {
  if (!items.length) return null;
  return (
    <div className="notices">
      {items.map((f, i) => (
        <article key={i} className="notice">
          <div className="notice-head" style={{ background: color, color: ink }}>
            <span>Service notice</span>
            <span>{String(i + 1).padStart(2, "0")}</span>
          </div>
          <div className="notice-body">
            <div className="notice-stat">{f.stat}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            {f.source && <p className="notice-source">{f.source}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}
