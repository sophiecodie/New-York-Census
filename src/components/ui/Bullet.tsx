type Props = { id: string; color: string; ink: string; size?: number; diamond?: boolean; title?: string };

/** An MTA-style route bullet. */
export default function Bullet({ id, color, ink, size = 28, title }: Props) {
  return (
    <span
      className="bullet"
      title={title}
      style={{
        width: size,
        height: size,
        background: color,
        color: ink,
        fontSize: size * 0.62,
      }}
      aria-label={title ?? `${id} line`}
    >
      {id}
    </span>
  );
}
