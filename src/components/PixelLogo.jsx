// "NEO CHESS DX" arcade logo: chunky extruded letters doing a stepped
// wave, plus a tilted DX sticker. `size` = 'lg' (menu) | 'sm' (in-game bar).
const word = (text, offset) =>
  text.split('').map((ch, i) => (
    <span key={i} className="logo-letter" style={{ '--i': i + offset }}>
      {ch}
    </span>
  ));

export function PixelLogo({ size = 'lg', as: Tag = 'h1' }) {
  return (
    <Tag className={`pixel-logo pixel-logo-${size}`} aria-label="Neo Chess DX">
      <span className="logo-neo" aria-hidden="true">{word('NEO', 0)}</span>
      <span className="logo-chess" aria-hidden="true">{word('CHESS', 3)}</span>
      <span className="logo-dx" aria-hidden="true">DX</span>
    </Tag>
  );
}
