// "CHESS FANTASY" arcade logo: chunky extruded letters doing a stepped
// wave. `size` = 'lg' (menu) | 'sm' (in-game bar).
const word = (text, offset) =>
  text.split('').map((ch, i) => (
    <span key={i} className="logo-letter" style={{ '--i': i + offset }}>
      {ch}
    </span>
  ));

export function PixelLogo({ size = 'lg', as: Tag = 'h1' }) {
  return (
    <Tag className={`pixel-logo pixel-logo-${size}`} aria-label="Chess Fantasy">
      <span className="logo-word-a" aria-hidden="true">{word('CHESS', 0)}</span>
      <span className="logo-word-b" aria-hidden="true">{word('FANTASY', 5)}</span>
    </Tag>
  );
}
