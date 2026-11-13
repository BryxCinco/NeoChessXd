import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import {
  PIECE_SKINS,
  PIECE_CODES,
  DEFAULT_PIECE_SKIN,
  getPieceSkin,
  pieceLayers,
  setActivePieceSkin,
  getActivePieceSkin,
} from './pieceSkins.js';
import { PieceSprite } from './pixelPieces';
import { PieceSkinContext } from './pieceSkinContext.js';
import { pixelPieces } from './boardPieces';
import { SettingsModal } from './components/SettingsModal';
import { useSettings, BOARD_THEMES, DEFAULT_SETTINGS, PIECE_SKIN_KEY, SETTINGS_KEY } from './hooks/useSettings';
import { SPRITES, PALETTE } from './sprites/pieceSprites';

const SKIN_IDS = Object.keys(PIECE_SKINS);

// ── colour maths (WCAG relative luminance / contrast ratio) ──
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const relLum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const pixelsOf = (piece) => piece.rows.flatMap((row) => [...row].filter((ch) => ch !== '.').map((ch) => piece.palette[ch]));

afterEach(() => {
  setActivePieceSkin(DEFAULT_PIECE_SKIN);
  localStorage.clear();
});

describe('piece skins: data', () => {
  it('ships Classic (default), Neon and Cursed', () => {
    expect(SKIN_IDS).toEqual(expect.arrayContaining(['classic', 'neon', 'cursed']));
    expect(DEFAULT_PIECE_SKIN).toBe('classic');
    for (const [id, skin] of Object.entries(PIECE_SKINS)) {
      expect(skin.id).toBe(id);
      expect(skin.name).toBeTruthy();
      expect(skin.description).toBeTruthy();
    }
  });

  it.each(SKIN_IDS)('%s: all 12 pieces are valid 16x16 grids with a colour for every character', (id) => {
    const { pieces } = PIECE_SKINS[id];
    expect(Object.keys(pieces).sort()).toEqual([...PIECE_CODES].sort());
    for (const piece of Object.values(pieces)) {
      expect(piece.rows).toHaveLength(16);
      for (const row of piece.rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== '.') expect(piece.palette[ch]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(pixelsOf(piece).length).toBeGreaterThan(40); // not an empty square
      expect(typeof piece.draw).toBe('function');
    }
  });

  it('Classic is exactly the original sprites', () => {
    for (const code of PIECE_CODES) {
      expect(PIECE_SKINS.classic.pieces[code].rows).toBe(SPRITES[code]);
      expect(PIECE_SKINS.classic.pieces[code].palette).toBe(PALETTE);
    }
  });

  it('the three skins really look different', () => {
    for (const code of PIECE_CODES) {
      const looks = SKIN_IDS.map((id) => JSON.stringify([PIECE_SKINS[id].pieces[code].rows, pixelsOf(PIECE_SKINS[id].pieces[code])]));
      expect(new Set(looks).size).toBe(SKIN_IDS.length);
    }
  });

  it('within a skin every piece type has its own shape', () => {
    for (const id of SKIN_IDS) {
      for (const side of ['w', 'b']) {
        const shapes = ['K', 'Q', 'R', 'B', 'N', 'P'].map((t) => PIECE_SKINS[id].pieces[side + t].rows.join(''));
        expect(new Set(shapes).size).toBe(6);
      }
    }
  });

  it('Neon is mostly dark fill with a bright outline; Cursed has bone, drips and glowing eyes', () => {
    for (const code of PIECE_CODES) {
      const neon = PIECE_SKINS.neon.pieces[code];
      const colours = pixelsOf(neon);
      expect(colours.filter((c) => c === neon.palette.N).length).toBeGreaterThan(20); // outline
      expect(colours.filter((c) => relLum(c) < 0.05).length).toBeGreaterThan(colours.length * 0.25); // dark body + halo

      const cursed = PIECE_SKINS.cursed.pieces[code];
      const used = new Set(cursed.rows.join(''));
      expect(used.has('W')).toBe(true); // bone
      expect(used.has('D')).toBe(true); // drips
      expect(used.has('E')).toBe(true); // eyes
      expect(cursed.eyes.has('E')).toBe(true);
    }
  });

  it('getPieceSkin falls back to Classic for unknown ids', () => {
    expect(getPieceSkin('neon')).toBe(PIECE_SKINS.neon);
    expect(getPieceSkin('nope')).toBe(PIECE_SKINS.classic);
    expect(getPieceSkin(undefined)).toBe(PIECE_SKINS.classic);
  });

  it('piece.draw paints one rect per pixel, scaled to the requested size', () => {
    const calls = [];
    const ctx = { fillStyle: '', fillRect: (...args) => calls.push([ctx.fillStyle, ...args]) };
    const piece = PIECE_SKINS.cursed.pieces.wK;
    piece.draw(ctx, 100, 50, 32);
    expect(calls).toHaveLength(pixelsOf(piece).length);
    for (const [fill, x, y, w, h] of calls) {
      expect(fill).toMatch(/^#/);
      expect(w).toBe(2);
      expect(h).toBe(2);
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThan(132);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThan(82);
    }
  });
});

describe('piece skins: RED vs BLUE stays clear (accessibility)', () => {
  it.each(SKIN_IDS)('%s: red pieces lean red and blue pieces lean blue, every piece', (id) => {
    for (const code of PIECE_CODES) {
      const colours = pixelsOf(PIECE_SKINS[id].pieces[code]);
      const lean = colours.reduce((sum, c) => sum + rgb(c)[0] - rgb(c)[2], 0) / colours.length;
      if (code[0] === 'w') expect(lean, `${id} ${code}`).toBeGreaterThan(20);
      else expect(lean, `${id} ${code}`).toBeLessThan(-5);
    }
  });

  it.each(SKIN_IDS)('%s: the two armies use clearly different main colours', (id) => {
    const average = (side) => {
      const colours = PIECE_CODES.filter((c) => c[0] === side).flatMap((c) => pixelsOf(PIECE_SKINS[id].pieces[c]));
      return [0, 1, 2].map((i) => colours.reduce((s, c) => s + rgb(c)[i], 0) / colours.length);
    };
    const [red, blue] = [average('w'), average('b')];
    expect(red[0] - red[2]).toBeGreaterThan(40);
    expect(blue[2] - blue[0]).toBeGreaterThan(40);
  });

  // On every board theme, on both square colours, a good share of each
  // piece must stand out from the square (contrast ratio 1.5+).
  const cases = SKIN_IDS.flatMap((skin) => Object.keys(BOARD_THEMES).map((theme) => [skin, theme]));
  it.each(cases)('%s pieces stand out on the %s board', (skin, theme) => {
    for (const code of PIECE_CODES) {
      const colours = pixelsOf(PIECE_SKINS[skin].pieces[code]);
      for (const square of [BOARD_THEMES[theme].light, BOARD_THEMES[theme].dark]) {
        const visible = colours.filter((c) => contrast(c, square) >= 1.5).length / colours.length;
        expect(visible, `${skin} ${code} on ${theme} ${square}`).toBeGreaterThanOrEqual(1 / 3);
      }
    }
  });
});

describe('piece skins: rendering', () => {
  it.each(SKIN_IDS)('%s: every piece renders as an SVG with paths', (id) => {
    for (const code of PIECE_CODES) {
      const { container, unmount } = render(<PieceSprite code={code} size={48} skin={id} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('data-skin', id);
      expect(svg).toHaveAttribute('width', '48');
      expect(svg.querySelectorAll('path').length).toBeGreaterThan(2);
      unmount();
    }
  });

  it('pieceLayers merges runs into one path per colour and caches the result', () => {
    const layers = pieceLayers('cursed', 'wP');
    expect(pieceLayers('cursed', 'wP')).toBe(layers);
    const fills = layers.body.map((p) => p.fill);
    expect(new Set(fills).size).toBe(fills.length);
    expect(layers.eyes).toHaveLength(1);
    expect(layers.eyes[0].fill).toBe(PIECE_SKINS.cursed.pieces.wP.palette.E);
    expect(pieceLayers('classic', 'zz')).toBeNull();
  });

  it('follows the skin from context, and the `skin` prop wins over it', () => {
    const { container, rerender } = render(
      <PieceSkinContext.Provider value="neon">
        <PieceSprite code="wQ" size={32} />
      </PieceSkinContext.Provider>
    );
    expect(container.querySelector('svg')).toHaveAttribute('data-skin', 'neon');

    rerender(
      <PieceSkinContext.Provider value="neon">
        <PieceSprite code="wQ" size={32} skin="cursed" />
      </PieceSkinContext.Provider>
    );
    expect(container.querySelector('svg')).toHaveAttribute('data-skin', 'cursed');
  });

  it('without a provider it is Classic; an unknown piece renders nothing', () => {
    const { container } = render(<PieceSprite code="bN" size={32} />);
    expect(container.querySelector('svg')).toHaveAttribute('data-skin', 'classic');
    expect(render(<PieceSprite code="xx" size={32} />).container.querySelector('svg')).toBeNull();
  });

  it('the board pieces follow the chosen skin too', () => {
    const BoardKing = pixelPieces.bK;
    const { container } = render(
      <PieceSkinContext.Provider value="cursed">
        <BoardKing squareWidth={60} />
      </PieceSkinContext.Provider>
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-skin', 'cursed');
    expect(svg.querySelector('.pixel-piece')).toBeInTheDocument(); // still animated
    expect(Object.keys(pixelPieces).sort()).toEqual([...PIECE_CODES].sort());
  });
});

describe('piece skins: settings and persistence', () => {
  it('Classic is the default', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.pieceSkin).toBe('classic');
    expect(DEFAULT_SETTINGS.pieceSkin).toBe('classic');
  });

  it('the choice is saved under neochess_piece_skin and survives a reload', () => {
    const first = renderHook(() => useSettings());
    act(() => first.result.current.updateSetting('pieceSkin', 'cursed'));
    expect(localStorage.getItem(PIECE_SKIN_KEY)).toBe('cursed');
    expect(PIECE_SKIN_KEY).toBe('neochess_piece_skin');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY))).not.toHaveProperty('pieceSkin');
    first.unmount();

    const second = renderHook(() => useSettings());
    expect(second.result.current.settings.pieceSkin).toBe('cursed');
  });

  it('an unknown saved skin falls back to Classic, and bad values are rejected', () => {
    localStorage.setItem(PIECE_SKIN_KEY, 'rainbow');
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.pieceSkin).toBe('classic');
    act(() => result.current.updateSetting('pieceSkin', 'neon'));
    act(() => result.current.updateSetting('pieceSkin', 'not-a-skin'));
    expect(result.current.settings.pieceSkin).toBe('classic');
  });

  it('RESET goes back to Classic; other settings are untouched by a skin change', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSetting('boardTheme', 'nes'));
    act(() => result.current.updateSetting('pieceSkin', 'neon'));
    expect(result.current.settings.boardTheme).toBe('nes');
    act(() => result.current.resetSettings());
    expect(result.current.settings.pieceSkin).toBe('classic');
    expect(localStorage.getItem(PIECE_SKIN_KEY)).toBe('classic');
  });

  it('the capture effects are told which skin is active', () => {
    const { result } = renderHook(() => useSettings());
    expect(getActivePieceSkin().id).toBe('classic');
    act(() => result.current.updateSetting('pieceSkin', 'neon'));
    expect(getActivePieceSkin()).toBe(PIECE_SKINS.neon);
    setActivePieceSkin('garbage');
    expect(getActivePieceSkin().id).toBe('classic');
  });

  it('SETTINGS shows a PIECE SKIN picker with a preview of each skin', () => {
    const onChange = vi.fn();
    render(<SettingsModal settings={{ ...DEFAULT_SETTINGS, pieceSkin: 'neon' }} onChange={onChange} onReset={() => {}} onClose={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'PIECE SKIN' });
    const options = [...group.querySelectorAll('[role=radio]')];
    expect(options.map((o) => o.textContent)).toEqual(['CLASSIC', 'NEON', 'CURSED']);
    expect(options[1]).toHaveAttribute('aria-checked', 'true');
    expect(options[0]).toHaveAttribute('aria-checked', 'false');
    for (const [i, id] of ['classic', 'neon', 'cursed'].entries()) {
      const previews = options[i].querySelectorAll('svg');
      expect(previews).toHaveLength(2); // a red and a blue king
      for (const svg of previews) expect(svg).toHaveAttribute('data-skin', id);
    }

    fireEvent.click(options[2]);
    expect(onChange).toHaveBeenCalledWith('pieceSkin', 'cursed');
  });
});
