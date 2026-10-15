// Idle bob / eye-blink keyframes live in App.css (.pixel-piece, .pixel-eye)
// so they're defined once instead of once per piece on the board.

export const pixelPieces = {
  // ── PAWN: Ang munting Sundalo (Mala-Mario Toad vibe) ──
  wP: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece">
        {/* Helmet / Hair */}
        <path d="M5 1h6v2H5V1zm-2 2h10v1H3V3z" fill="#718096" />
        {/* Mukha at Balat */}
        <path d="M3 4h10v4H3V4z" fill="#fbd38d" />
        {/* Mata (Kumukurap) */}
        <path className="pixel-eye" d="M5 5h1v2H5V5zm5 0h1v2h-1V5z" fill="#000000"/>
        {/* Rosy Cheeks para may buhay */}
        <path d="M3 6h1v1H3V6zm9 0h1v1h-1V6z" fill="#f56565" />
        {/* Bibig */}
        <path d="M7 7h2v1H7V7z" fill="#742a2a" />
        {/* Damit (Pula para sa White side) */}
        <path d="M3 8h10v5H3V8zm1 5h8v1H4v-1z" fill="#ff3333"/>
        {/* Sinturon */}
        <path d="M3 10h10v1H3v-1z" fill="#2d3748"/>
        {/* Paa */}
        <path d="M4 14h3v1H4v-1zm5 0h3v1H9v-1z" fill="#4a5568"/>
      </g>
    </svg>
  ),

  // ── KNIGHT: Ang Kabalyero (May helmet at balbas) ──
  wN: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece" style={{ animationDelay: '0.2s' }}>
        {/* Plume sa Helmet (Gumagalaw/Gumalaw) */}
        <path d="M2 1h5v2H2V1zm5 1h3v1H7V2z" fill="#ff3333"/>
        {/* Helmet */}
        <path d="M3 3h10v5H3V3z" fill="#a0aec0"/>
        {/* Face Visor Area */}
        <path d="M4 4h8v3H4V4z" fill="#4a5568"/>
        {/* Kumikinang na Mata sa dilim ng helmet */}
        <path d="M5 5h2v1H5V5zm4 0h2v1H9V5z" fill="#00ffff"/>
        {/* Armor at Katawan */}
        <path d="M3 8h10v5H3V8zm2 5h6v1H5v-1z" fill="#ff3333"/>
        {/* Shoulder Pads */}
        <path d="M1 8h2v3H1V8zm12 0h2v3h-2V8z" fill="#e2e8f0"/>
        <path d="M4 14h8v1H4v-1z" fill="#2d3748"/>
      </g>
    </svg>
  ),

  // ── BISHOP: Ang Salamangkero / Pari (Mala-Megamind ang talino) ──
  wB: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece" style={{ animationDelay: '0.4s' }}>
        {/* Mitre Hat / Wizard Cap */}
        <path d="M7 0h2v2H7V0zm-1 2h4v1H6V2zm-1 3h6v1H5V3zm-1 1h8v1H4V4z" fill="#ff3333"/>
        {/* Mukha */}
        <path d="M4 5h8v4H4V5z" fill="#fbd38d"/>
        {/* Matang Kumukurap na may Tula (Glowing Magic Eyes) */}
        <path className="pixel-eye" d="M5 6h1v1H5V6zm5 0h1v1h-1V6z" fill="#00ffff"/>
        {/* Mahabang Balbas */}
        <path d="M5 9h6v3H5V9zm1 3h4v1H6v-1z" fill="#e2e8f0"/>
        {/* Robe / Kapa */}
        <path d="M3 10h10v4H3v-4z" fill="#ff3333"/>
        <path d="M2 13h12v1H2v-1z" fill="#990000"/>
      </g>
    </svg>
  ),

  // ── ROOK: Ang Golem / Kastilyong Tao (Mala-Rampage o Bulk) ──
  wR: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece" style={{ animationDelay: '0.1s' }}>
        {/* Batong Korona / Buhok */}
        <path d="M2 1h3v2H2V1zm4 0h4v2H6V1zm5 0h3v2h-3V1z" fill="#4a5568"/>
        {/* Higanteng Mukha */}
        <path d="M2 3h12v5H2V3z" fill="#fbd38d"/>
        {/* Galit/Seryosong Mata */}
        <path d="M4 4h2v1H4V4zm6 0h2v1h-2V4z" fill="#000000"/>
        {/* Makapal na Bigote (Mala-Mario!) */}
        <path d="M3 6h10v1H3V6z" fill="#4a1505"/>
        {/* Malaking Armor / Katawan */}
        <path d="M1 8h14v5H1V8z" fill="#ff3333"/>
        {/* Chest Plate */}
        <path d="M4 9h8v2H4V9z" fill="#718096"/>
        <path d="M2 13h12v2H2v-2z" fill="#1a202c"/>
      </g>
    </svg>
  ),

  // ── QUEEN: Ang Reyna (Eleganteng may Kapa at Korona) ──
  wQ: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece" style={{ animationDelay: '0.3s' }}>
        {/* Gintong Korona na may hiyas */}
        <path d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#d69e2e"/>
        <path d="M4 2h8v1H4V2z" fill="#ecc94b"/>
        {/* Magandang Buhok at Mukha */}
        <path d="M3 3h10v6H3V3z" fill="#ecc94b"/>
        <path d="M5 4h6v4H5V4z" fill="#fbd38d"/>
        {/* Magandang Mata na may Pilikmata */}
        <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#000000"/>
        <path d="M4 5h1v1H4V5zm7 0h1v1h-1V5z" fill="#4a5568"/>
        {/* Lipstick / Bibig */}
        <path d="M7 7h2v1H7V7z" fill="#f56565"/>
        {/* Magarang Gown */}
        <path d="M2 9h12v5H2V9z" fill="#ff3333"/>
        {/* Kwintas / Detalye */}
        <path d="M5 9h6v2H5V9z" fill="#fff5f5"/>
        <path d="M1 14h14v1H1v-1z" fill="#990000"/>
      </g>
    </svg>
  ),

  // ── KING: Ang Hari (Mala-Megamind ang Noo o Mario na may balbas) ──
  wK: ({ squareWidth }) => (
    <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="pixel-piece" style={{ animationDelay: '0.5s' }}>
        {/* Malaking Korona na may Krus */}
        <path d="M7-1h2v2H7V-1zm-3 1h2v2H4V0zm6 0h2v2h-2V0z" fill="#d69e2e"/>
        <path d="M3 2h10v2H3V2z" fill="#ecc94b"/>
        {/* Mukha at Maharlikang Balbas */}
        <path d="M4 4h8v4H4V4z" fill="#fbd38d"/>
        <path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#000000"/>
        {/* Malaking Bigote */}
        <path d="M4 6h8v1H4V6z" fill="#744210"/>
        {/* Royal Robe */}
        <path d="M2 10h12v4H2v-4z" fill="#ff3333"/>
        {/* Gintong sinturon / Trim */}
        <path d="M4 10h8v1H4v-1z" fill="#ecc94b"/>
        <path d="M1 14h14v1H1v-1z" fill="#990000"/>
      </g>
    </svg>
  ),

  // ── BLACK PIECES (Kopyang may Blue theme para sa kalaban) ──
  bP: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '0.6s' }}><path d="M5 1h6v2H5V1zm-1 2h8v1H4V3z" fill="#4a5568" /><path d="M4 4h8v4H4V4z" fill="#cbd5e0" /><path className="pixel-eye" d="M5 5h1v2H5V5zm5 0h1v2h-1V5z" fill="#ff3333"/><path d="M3 8h10v5H3V8zm1 5h8v1H4v-1z" fill="#00b3ff"/><path d="M3 10h10v1H3v-1z" fill="#004499"/><path d="M4 14h3v1H4v-1zm5 0h3v1H9v-1z" fill="#1a202c"/></g></svg>,
  bN: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '0.7s' }}><path d="M2 1h5v2H2V1zm5 1h3v1H7V2z" fill="#00b3ff"/><path d="M3 3h10v5H3V3z" fill="#4a5568"/>{/* Neon cyber eyes para sa dark side */}<path d="M4 4h8v3H4V4z" fill="#2d3748"/><path d="M5 5h2v1H5V5zm4 0h2v1H9V5z" fill="#00b3ff"/><path d="M3 8h10v5H3V8zm2 5h6v1H5v-1z" fill="#00b3ff"/><path d="M1 8h2v3H1V8zm12 0h2v3h-2V8z" fill="#718096"/><path d="M4 14h8v1H4v-1z" fill="#1a202c"/></g></svg>,
  bB: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '0.8s' }}><path d="M7 0h2v2H7V0zm-1 2h4v1H6V2zm-1 3h6v1H5V3zm-1 1h8v1H4V4z" fill="#00b3ff"/><path d="M4 5h8v4H4V5z" fill="#cbd5e0"/><path className="pixel-eye" d="M5 6h1v1H5V6zm5 0h1v1h-1V6z" fill="#ff3333"/><path d="M5 9h6v3H5V9zm1 3h4v1H6v-1z" fill="#718096"/><path d="M3 10h10v4H3v-4z" fill="#00b3ff"/><path d="M2 13h12v1H2v-1z" fill="#004499"/></g></svg>,
  bR: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '0.9s' }}><path d="M2 1h3v2H2V1zm4 0h4v2H6V1zm5 0h3v2h-3V1z" fill="#1a202c"/><path d="M2 3h12v5H2V3z" fill="#cbd5e0"/><path d="M4 4h2v1H4V4zm6 0h2v1h-2V4z" fill="#ff3333"/><path d="M3 6h10v1H3V6z" fill="#2d3748"/><path d="M1 8h14v5H1V8z" fill="#00b3ff"/><path d="M4 9h8v2H4V9z" fill="#2d3748"/><path d="M2 13h12v2H2v-2z" fill="#1a202c"/></g></svg>,
  bQ: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '1.0s' }}><path d="M3 1h2v2H3V1zm4-1h2v3H7V0zm4 1h2v2h-2V1z" fill="#d69e2e"/><path d="M4 2h8v1H4V2z" fill="#ecc94b"/><path d="M3 3h10v6H3V3z" fill="#4a5568"/><path d="M5 4h6v4H5V4z" fill="#cbd5e0"/><path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#ff3333"/><path d="M4 5h1v1H4V5zm7 0h1v1h-1V5z" fill="#1a202c"/><path d="M7 7h2v1H7V7z" fill="#e53e3e"/><path d="M2 9h12v5H2V9z" fill="#00b3ff"/><path d="M5 9h6v2H5V9z" fill="#fff5f5"/><path d="M1 14h14v1H1v-1z" fill="#004499"/></g></svg>,
  bK: ({ squareWidth }) => <svg width={squareWidth} height={squareWidth} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g className="pixel-piece" style={{ animationDelay: '1.1s' }}><path d="M7-1h2v2H7V-1zm-3 1h2v2H4V0zm6 0h2v2h-2V0z" fill="#d69e2e"/><path d="M3 2h10v2H3V2z" fill="#ecc94b"/><path d="M4 4h8v4H4V4z" fill="#cbd5e0"/><path className="pixel-eye" d="M5 5h1v1H5V5zm5 0h1v1h-1V5z" fill="#ff3333"/><path d="M4 6h8v1H4V6z" fill="#2d3748"/><path d="M2 10h12v4H2v-4z" fill="#00b3ff"/><path d="M4 10h8v1H4v-1z" fill="#ecc94b"/><path d="M1 14h14v1H1v-1z" fill="#004499"/></g></svg>,
};