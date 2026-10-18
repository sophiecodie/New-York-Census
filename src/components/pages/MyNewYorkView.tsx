"use client";

import { useEffect, useRef, useState } from "react";
import { A_LINE } from "@/content/lines";
import { PLACES } from "@/content/places";
import { hasGeo } from "@/lib/data";
import { getProjection } from "@/lib/geo";
import NycMap from "@/components/map/NycMap";
import Route from "@/components/map/Route";
import Bullet from "@/components/ui/Bullet";

const aLine = {
  ...A_LINE,
  offset: [0, 0] as [number, number],
  stops: PLACES.map((p) => ({ id: p.id, at: p.at, hood: p.name, label: "right" as const })),
};

export default function MyNewYorkView() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const open = openIdx === null ? null : PLACES[openIdx];

  const panelRef = useRef<HTMLElement>(null);
  const show = (i: number) => {
    setOpenIdx(i);
    setPhotoIdx(0);
  };
  // on phones the panel sits below the map, so bring it into view
  const showFromMap = (i: number) => {
    show(i);
    const r = panelRef.current?.getBoundingClientRect();
    if (r && r.top > window.innerHeight - 120) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const step = (d: number) => setPhotoIdx((i) => (open ? (i + d + open.photos.length) % open.photos.length : 0));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // default camera: fit all your places, with room for the photo frames
  const proj = getProjection(1000, 1000);
  const xy = PLACES.map((p) => proj(p.at) ?? [500, 500]);
  const xs = xy.map((d) => d[0]),
    ys = xy.map((d) => d[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 60);
  const fitZoom = PLACES.length ? Math.min(3.2, Math.max(1, 1000 / (span + 260))) : 1;
  const fitCenter = PLACES.length ? (proj.invert?.([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2 - 30]) as [number, number]) : null;

  // the selected / hovered pin is drawn last so its photo sits on top
  const rank = (id: string) => (id === open?.id ? 2 : id === hover ? 1 : 0);
  const order = [...PLACES.entries()].sort(([, a], [, b]) => rank(a.id) - rank(b.id));

  return (
    <div className="topic mny">
      <section className="topic-hero">
        <div className="eyebrow" style={{ color: A_LINE.color }}>
          Last stop · the A line
        </div>
        <h1>My New York</h1>
        <div className="topic-intro">
          <p>The data shows how the city works. These are the places that made it mine. Zoom in, wander around, and tap a photo to open it.</p>
        </div>
      </section>

      <section className="mny-grid">
        <div className="mny-map">
          {hasGeo ? (
            <NycMap interactive focus={fitCenter ? { center: fitCenter, zoom: fitZoom } : null} ariaLabel="Map of places that matter to me">
              {(project, zoom) => (
                <>
                  <Route line={aLine} project={project} zoom={zoom} width={5} labels={false} />
                  {order.map(([i, p]) => {
                    const [x, y] = project(p.at);
                    const s = 64 / zoom;
                    const rot = ((i * 37) % 11) - 5;
                    const sel = p.id === open?.id;
                    return (
                      <g
                        key={p.id}
                        className={`photo-pin${sel ? " on" : ""}`}
                        transform={`translate(${x} ${y})`}
                        onClick={() => showFromMap(i)}
                        onMouseEnter={() => setHover(p.id)}
                        onMouseLeave={() => setHover(null)}
                        role="button"
                        aria-label={`Open photos of ${p.name}`}
                      >
                        <circle r={7 / zoom} fill={sel ? A_LINE.color : "#fff"} stroke={A_LINE.color} strokeWidth={3 / zoom} />
                        <g transform={`translate(${-s / 2} ${-s - 14 / zoom}) rotate(${rot} ${s / 2} ${s / 2})`}>
                          <rect
                            x={-4 / zoom}
                            y={-4 / zoom}
                            width={s + 8 / zoom}
                            height={s + 8 / zoom}
                            fill={sel ? A_LINE.color : "#fff"}
                            rx={3 / zoom}
                            className="pin-frame"
                          />
                          {p.photos[0] ? (
                            <image href={p.photos[0]} width={s} height={s} preserveAspectRatio="xMidYMid slice" />
                          ) : (
                            <>
                              <rect width={s} height={s} fill="#E8EEF8" />
                              <text x={s / 2} y={s / 2 + 5 / zoom} textAnchor="middle" fontSize={14 / zoom} fill={A_LINE.color} fontWeight={700}>
                                {i + 1}
                              </text>
                            </>
                          )}
                        </g>
                        <text
                          y={20 / zoom}
                          textAnchor="middle"
                          fontSize={11.5 / zoom}
                          className="station-label"
                          fontWeight={700}
                          paintOrder="stroke"
                          stroke="var(--land)"
                          strokeWidth={3.5 / zoom}
                        >
                          {p.name.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}
            </NycMap>
          ) : (
            <p className="muted">Run the data script to draw the map.</p>
          )}
        </div>

        <aside className="mny-panel" ref={panelRef} aria-live="polite">
          {open && openIdx !== null ? (
            <>
              <div className="mny-panel-head">
                <Bullet id="A" color={A_LINE.color} ink="#fff" size={26} />
                <div>
                  <h2>{open.name}</h2>
                  <small>
                    {open.neighborhood}
                    {open.date ? ` · ${open.date}` : ""}
                  </small>
                </div>
                <button className="pop-x" onClick={() => setOpenIdx(null)} aria-label="Close">
                  ×
                </button>
              </div>
              {open.photos.length ? (
                <div className="mny-photo">
                  <img src={open.photos[photoIdx]} alt={`${open.name} photo ${photoIdx + 1}`} />
                  {open.photos.length > 1 && (
                    <>
                      <button className="mny-arrow prev" onClick={() => step(-1)} aria-label="Previous photo">
                        ‹
                      </button>
                      <button className="mny-arrow next" onClick={() => step(1)} aria-label="Next photo">
                        ›
                      </button>
                      <div className="lightbox-nav">
                        {open.photos.map((_, i) => (
                          <button key={i} className={i === photoIdx ? "on" : ""} onClick={() => setPhotoIdx(i)} aria-label={`Photo ${i + 1}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="lightbox-empty">
                  Add photos for this place in <code>src/content/places.ts</code> and put the files in <code>public/photos/</code>.
                </div>
              )}
              <p className="lightbox-caption">{open.caption}</p>
              <div className="mny-stops">
                <button disabled={openIdx === 0} onClick={() => show(openIdx - 1)}>
                  ← {openIdx > 0 ? PLACES[openIdx - 1].name : ""}
                </button>
                <span>
                  Stop {openIdx + 1} of {PLACES.length}
                </span>
                <button disabled={openIdx === PLACES.length - 1} onClick={() => show(openIdx + 1)}>
                  {openIdx < PLACES.length - 1 ? PLACES[openIdx + 1].name : ""} →
                </button>
              </div>
            </>
          ) : (
            <div className="mny-panel-empty">
              <Bullet id="A" color={A_LINE.color} ink="#fff" size={34} />
              <p>Tap a photo on the map to see it here.</p>
              <button onClick={() => show(0)}>Start at stop 1 →</button>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
