import { render, screen, act, fireEvent } from '@testing-library/react';
import { FxGallery } from './FxGallery';
import { EFFECT_POOLS, EFFECT_LABELS, FX_SOUND } from '../fx/eliminationFx';

// jsdom has no canvas. This stand-in accepts any drawing call: every
// property is the same callable object, and it reads as 0 in arithmetic.
function fakeContext() {
  const ctx = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : ctx),
    set: () => true,
    apply: () => ctx,
  });
  return ctx;
}

const firstKind = EFFECT_POOLS.p[0];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext());
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 300, left: 0, top: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('FxGallery', () => {
  it('lists a button for every effect of every piece', () => {
    render(<FxGallery onClose={() => {}} play={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Effects gallery' })).toBeInTheDocument();
    const total = Object.values(EFFECT_POOLS).reduce((n, pool) => n + pool.length, 0);
    expect(document.querySelectorAll('.fx-btn')).toHaveLength(total);
    for (const name of ['PAWN', 'KNIGHT', 'BISHOP', 'ROOK', 'QUEEN', 'KING']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('closes with the ✕ button, with Escape and by clicking outside — but not inside', () => {
    const onClose = vi.fn();
    render(<FxGallery onClose={onClose} play={() => {}} />);

    fireEvent.click(screen.getByText('FX GALLERY'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('.fx-gallery-overlay'));
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('plays one effect with its sound, marks it as playing, then finishes', () => {
    const play = vi.fn();
    render(<FxGallery onClose={() => {}} play={play} />);
    const button = screen.getAllByRole('button', { name: EFFECT_LABELS[firstKind] })[0];

    fireEvent.click(button);
    expect(play).toHaveBeenCalledWith(FX_SOUND[firstKind]);
    expect(button).toHaveClass('is-playing');

    act(() => vi.advanceTimersByTime(6000)); // longer than any effect
    expect(button).not.toHaveClass('is-playing');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('PLAY ALL runs the effects one after another', () => {
    const play = vi.fn();
    render(<FxGallery onClose={() => {}} play={play} />);

    fireEvent.click(document.querySelector('.fx-play-all'));
    expect(play).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(8000));
    expect(play.mock.calls.length).toBeGreaterThan(1);
    expect(play.mock.calls[1][0]).toBe(FX_SOUND[EFFECT_POOLS.p[1] ?? EFFECT_POOLS.n[0]]);
  });

  it('picking a single effect cancels a running PLAY ALL', () => {
    const play = vi.fn();
    render(<FxGallery onClose={() => {}} play={play} />);
    fireEvent.click(document.querySelector('.fx-play-all'));
    fireEvent.click(screen.getAllByRole('button', { name: EFFECT_LABELS[firstKind] })[0]);
    expect(play).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(20000));
    expect(play).toHaveBeenCalledTimes(2); // the queue was dropped
    expect(document.querySelector('.fx-btn.is-playing')).not.toBeInTheDocument();
  });
});
