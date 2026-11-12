import { createRef, useState } from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chess } from 'chess.js';
import { GameOverBar } from './GameOverBar';
import { SettingsModal } from './SettingsModal';
import { PixelToast } from './PixelToast';
import { MoveScoresheet } from './MoveScoresheet';
import { GameBoardScreen } from './GameBoardScreen';
import { CountdownOverlay } from './CountdownOverlay';
import { SaveSlotCard } from './SaveSlotCard';
import { DEFAULT_SETTINGS, BOARD_THEMES, sanitizeSettings } from '../hooks/useSettings';

let boardProps = null;
vi.mock('react-chessboard', () => ({
  Chessboard: (props) => {
    boardProps = props;
    return <div data-testid="board" />;
  },
}));

const click = (name) => userEvent.click(screen.getByRole('button', { name }));

describe('GameOverBar', () => {
  const barProps = (extra = {}) => ({
    gameStatus: 'WINNER: RED (P1)',
    winner: 'w',
    isReviewing: false,
    reviewPly: null,
    totalPlies: 40,
    onRematch: vi.fn(),
    onViewBoard: vi.fn(),
    onExit: vi.fn(),
    onStep: vi.fn(),
    onJump: vi.fn(),
    onExitReview: vi.fn(),
    onCopyPgn: vi.fn(),
    onDownloadPgn: vi.fn(),
    ...extra,
  });

  it('shows the result with REMATCH, VIEW BOARD and EXIT — as a bar, not a dialog', async () => {
    const props = barProps();
    render(<GameOverBar {...props} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // nothing covers the board
    expect(screen.getByRole('status', { name: 'Game over' })).toBeInTheDocument();
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    expect(screen.getByText('WINNER: RED (P1)')).toBeInTheDocument();

    await click(/REMATCH/);
    expect(props.onRematch).toHaveBeenCalledTimes(1);
    await click(/VIEW BOARD/);
    expect(props.onViewBoard).toHaveBeenCalledTimes(1);
    await click(/EXIT/);
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it('has COPY PGN and DOWNLOAD PGN', async () => {
    const props = barProps();
    render(<GameOverBar {...props} />);
    await click(/COPY PGN/);
    expect(props.onCopyPgn).toHaveBeenCalledTimes(1);
    await click(/DOWNLOAD PGN/);
    expect(props.onDownloadPgn).toHaveBeenCalledTimes(1);
  });

  it('shows one king for a win and both for a draw', () => {
    const { container, rerender } = render(<GameOverBar {...barProps()} />);
    expect(container.querySelectorAll('.gob-hero svg')).toHaveLength(1);
    rerender(<GameOverBar {...barProps({ winner: null, gameStatus: 'DRAW - BY AGREEMENT' })} />);
    expect(container.querySelectorAll('.gob-hero svg')).toHaveLength(2);
    expect(screen.getByText('DRAW - BY AGREEMENT')).toBeInTheDocument();
  });

  it('review mode: < and > step, the end buttons jump, and the counter shows the position', async () => {
    const props = barProps({ isReviewing: true, reviewPly: 12 });
    render(<GameOverBar {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('MOVE 12 / 40');
    expect(screen.queryByRole('button', { name: /REMATCH/ })).not.toBeInTheDocument();

    await click('Previous move');
    expect(props.onStep).toHaveBeenLastCalledWith(-1);
    await click('Next move');
    expect(props.onStep).toHaveBeenLastCalledWith(1);
    await click('First position');
    expect(props.onJump).toHaveBeenLastCalledWith(0);
    await click('Last position');
    expect(props.onJump).toHaveBeenLastCalledWith(40);
    await click(/CLOSE REVIEW/);
    expect(props.onExitReview).toHaveBeenCalledTimes(1);
  });

  it('review mode: buttons that would go past either end are disabled', () => {
    const { rerender } = render(<GameOverBar {...barProps({ isReviewing: true, reviewPly: 0 })} />);
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'First position' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next move' })).toBeEnabled();

    rerender(<GameOverBar {...barProps({ isReviewing: true, reviewPly: 40 })} />);
    expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last position' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous move' })).toBeEnabled();
  });
});

describe('MoveScoresheet — jump to move and notes', () => {
  const rows = [
    { number: 1, white: 'e4', black: 'e5' },
    { number: 2, white: 'Nf3', black: 'Nc6' },
    { number: 3, white: 'Bb5', black: null },
  ];
  const sheet = (extra = {}) => (
    <MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="WINNER: RED (P1)" isCompactLayout={false} {...extra} />
  );

  it('moves are plain text during a game: nothing to click', () => {
    render(sheet({ gameStatus: 'BLUE TURN' }));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Nf3').tagName).toBe('SPAN');
  });

  it('with onJumpToPly, each move is a button that jumps to the position after it', async () => {
    const onJumpToPly = vi.fn();
    render(sheet({ onJumpToPly }));
    expect(screen.getAllByRole('button')).toHaveLength(5); // the unplayed reply is not clickable

    await click('Go to move 1 by Red: e4');
    await click('Go to move 1 by Blue: e5');
    await click('Go to move 2 by Blue: Nc6');
    await click('Go to move 3 by Red: Bb5');
    expect(onJumpToPly.mock.calls.flat()).toEqual([1, 2, 4, 5]);
  });

  it('highlights the move being reviewed instead of the last one', () => {
    const { rerender } = render(sheet({ onJumpToPly: () => {} }));
    expect(screen.getByRole('button', { name: /Bb5/ })).toHaveAttribute('aria-current', 'step'); // live: last move

    rerender(sheet({ onJumpToPly: () => {}, activePly: 2 }));
    expect(screen.getByRole('button', { name: /: e5/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /: e5/ }).style.fontWeight).toBe('bold');
    expect(screen.getByRole('button', { name: /Bb5/ })).not.toHaveAttribute('aria-current');

    rerender(sheet({ onJumpToPly: () => {}, activePly: 0 })); // start position: nothing highlighted
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('numbers plies correctly when Blue moved first (game loaded from a position)', async () => {
    const onJumpToPly = vi.fn();
    render(
      <MoveScoresheet
        moveHistory={[{ number: 1, white: null, black: 'Kg7' }, { number: 2, white: 'Kf2', black: null }]}
        lastMove="Kf2"
        gameStatus="DRAW - STALEMATE"
        isCompactLayout={false}
        onJumpToPly={onJumpToPly}
      />
    );
    await click(/Kg7/);
    await click(/Kf2/);
    expect(onJumpToPly.mock.calls.flat()).toEqual([1, 2]);
  });

  it('lists resignations and draw offers under the moves', () => {
    render(sheet({ notes: [{ ply: 3, text: 'BLUE OFFERED A DRAW - DECLINED' }, { ply: 5, text: 'BLUE RESIGNED' }] }));
    const notes = within(document.querySelector('.scoresheet-notes')).getAllByRole('listitem');
    expect(notes.map((n) => n.textContent)).toEqual(['▸ BLUE OFFERED A DRAW - DECLINED', '▸ BLUE RESIGNED']);
  });

  it('shows a note and the result even when no move was played', () => {
    render(
      <MoveScoresheet
        moveHistory={[]}
        lastMove={null}
        gameStatus="RESIGNED - WINNER: BLUE (P2)"
        isCompactLayout
        notes={[{ ply: 0, text: 'RED RESIGNED' }]}
      />
    );
    expect(screen.getByText('▸ RED RESIGNED')).toBeInTheDocument();
    expect(screen.getByText('RESIGNED - BLUE (P2)')).toBeInTheDocument();
  });
});

describe('GameBoardScreen — side, theme and review wiring', () => {
  const formatTime = (s) => `T${Math.ceil(s)}`;
  const screenProps = (extra = {}) => ({
    boardWrapperRef: createRef(),
    boardInnerRef: createRef(),
    canvasRef: createRef(),
    boardWidth: 400,
    game: new Chess(),
    onDrop: vi.fn(),
    onSquareClick: vi.fn(),
    onPieceDragBegin: vi.fn(),
    isDraggablePiece: vi.fn(),
    botThinking: false,
    checkmateFx: false,
    captured: { w: [], b: [], material: 0 },
    customSquareStyles: {},
    displayPosition: new Chess().fen(),
    gameStatus: 'RED TURN',
    gameMode: 'bot',
    timeMode: 'none',
    whiteTime: 600,
    blackTime: 600,
    formatTime,
    moveHistory: [],
    lastMove: null,
    isCompactLayout: false,
    isGameOver: false,
    ...extra,
  });
  const barOrder = (container) =>
    [...container.querySelectorAll('.board-column > .player-bar')].map((el) => (el.classList.contains('player-bar-w') ? 'w' : 'b'));

  it('playing RED: board the normal way, you at the bottom, the CPU on top', () => {
    const { container } = render(<GameBoardScreen {...screenProps()} />);
    expect(boardProps.boardOrientation).toBe('white');
    expect(barOrder(container)).toEqual(['b', 'w']);
    expect(screen.getByText('P1 RED (YOU)')).toBeInTheDocument();
    expect(screen.getByText('P2 BLUE (CPU)')).toBeInTheDocument();
  });

  it('playing BLUE: the board is flipped and the player bars swap', () => {
    const { container } = render(
      <GameBoardScreen {...screenProps({ boardOrientation: 'black', playerColor: 'b', botThinking: true })} />
    );
    expect(boardProps.boardOrientation).toBe('black');
    expect(barOrder(container)).toEqual(['w', 'b']); // your BLUE army is at the bottom
    expect(screen.getByText('P2 BLUE (YOU)')).toBeInTheDocument();
    expect(screen.getByText(/P1 RED \(CPU\)/)).toBeInTheDocument();
    // the THINKING tag sits on the CPU's bar, which is now RED
    expect(within(container.querySelector('.player-bar-w')).getByText('THINKING')).toBeInTheDocument();
    expect(container.querySelector('.player-bar-b')).not.toHaveTextContent('THINKING');
  });

  it('uses the chosen board theme, defaulting to the classic colours', () => {
    const { rerender } = render(<GameBoardScreen {...screenProps()} />);
    expect(boardProps.customLightSquareStyle).toEqual({ backgroundColor: BOARD_THEMES.classic.light });
    expect(boardProps.customDarkSquareStyle).toEqual({ backgroundColor: BOARD_THEMES.classic.dark });

    rerender(<GameBoardScreen {...screenProps({ theme: BOARD_THEMES.gameboy })} />);
    expect(boardProps.customLightSquareStyle).toEqual({ backgroundColor: '#9bbc0f' });
    expect(boardProps.customDarkSquareStyle).toEqual({ backgroundColor: '#306230' });
  });

  it('animations off: pieces stop sliding', () => {
    const { rerender } = render(<GameBoardScreen {...screenProps()} />);
    expect(boardProps.animationDuration).toBe(180);
    rerender(<GameBoardScreen {...screenProps({ animations: false })} />);
    expect(boardProps.animationDuration).toBe(0);
  });

  it('renders the game-over bar it is given inside the side column, beside the board', () => {
    const { container } = render(
      <GameBoardScreen {...screenProps({ isGameOver: true })}>
        <div data-testid="bar">GAME OVER</div>
      </GameBoardScreen>
    );
    const bar = screen.getByTestId('bar');
    expect(container.querySelector('.side-pixel-wrapper')).toContainElement(bar);
    expect(container.querySelector('.board-column')).not.toContainElement(bar);
  });

  it('passes the review hooks and the match log on to the scoresheet', async () => {
    const onJumpToPly = vi.fn();
    render(
      <GameBoardScreen
        {...screenProps({
          isGameOver: true,
          gameStatus: 'RESIGNED - WINNER: RED (P1 / YOU)',
          moveHistory: [{ number: 1, white: 'e4', black: 'e5' }],
          lastMove: 'e5',
          onJumpToPly,
          activePly: 1,
          matchNotes: [{ ply: 2, text: 'BLUE RESIGNED' }],
        })}
      />
    );
    await click('Go to move 1 by Blue: e5');
    expect(onJumpToPly).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: /: e4/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('▸ BLUE RESIGNED')).toBeInTheDocument();
  });
});

describe('SettingsModal', () => {
  // Holds the settings like useSettings does, so the controls really change.
  function Harness({ onChange, onReset, onClose }) {
    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
    return (
      <SettingsModal
        settings={settings}
        onChange={(key, value) => {
          onChange(key, value);
          setSettings((prev) => sanitizeSettings({ ...prev, [key]: value }));
        }}
        onReset={() => {
          onReset();
          setSettings({ ...DEFAULT_SETTINGS });
        }}
        onClose={onClose}
      />
    );
  }
  const renderSettings = () => {
    const handlers = { onChange: vi.fn(), onReset: vi.fn(), onClose: vi.fn() };
    render(<Harness {...handlers} />);
    return handlers;
  };

  it('has music and SFX volume sliders from 0 to 100', () => {
    const { onChange } = renderSettings();
    const music = screen.getByRole('slider', { name: 'MUSIC VOLUME' });
    const sfx = screen.getByRole('slider', { name: 'SFX VOLUME' });
    expect(music).toHaveAttribute('min', '0');
    expect(music).toHaveAttribute('max', '100');
    expect(music).toHaveValue('100');

    fireEvent.change(music, { target: { value: '35' } });
    expect(onChange).toHaveBeenLastCalledWith('musicVolume', 35);
    expect(music).toHaveValue('35');

    fireEvent.change(sfx, { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith('sfxVolume', 0);
    expect(sfx).toHaveValue('0');
  });

  it('toggles animations and screen FX on and off', async () => {
    const { onChange } = renderSettings();
    const animations = screen.getByRole('switch', { name: 'ANIMATIONS' });
    const screenFx = screen.getByRole('switch', { name: 'SCREEN FX' });
    expect(animations).toBeChecked();
    expect(animations).toHaveTextContent('ON');

    await userEvent.click(animations);
    expect(onChange).toHaveBeenLastCalledWith('animations', false);
    expect(animations).not.toBeChecked();
    expect(animations).toHaveTextContent('OFF');

    await userEvent.click(animations);
    expect(animations).toBeChecked();

    await userEvent.click(screenFx);
    expect(onChange).toHaveBeenLastCalledWith('screenFx', false);
    expect(screenFx).not.toBeChecked();
  });

  it('offers every board theme and marks the selected one', async () => {
    const { onChange } = renderSettings();
    const group = screen.getByRole('radiogroup', { name: 'BOARD THEME' });
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual(['CLASSIC', 'GAME BOY', 'NES', 'CRT AMBER']);
    expect(screen.getByRole('radio', { name: 'CLASSIC' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'GAME BOY' }));
    expect(onChange).toHaveBeenLastCalledWith('boardTheme', 'gameboy');
    expect(screen.getByRole('radio', { name: 'GAME BOY' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'CLASSIC' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'CRT AMBER' }));
    expect(onChange).toHaveBeenLastCalledWith('boardTheme', 'amber');
  });

  it('RESET restores the defaults; DONE and Escape close', async () => {
    const { onReset, onClose } = renderSettings();
    await userEvent.click(screen.getByRole('radio', { name: 'NES' }));
    await click('RESET TO DEFAULTS');
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: 'CLASSIC' })).toBeChecked();

    await click('DONE');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('PixelToast', () => {
  it('renders nothing without a message', () => {
    expect(render(<PixelToast toast={null} onDismiss={() => {}} />).container).toBeEmptyDOMElement();
  });

  it('announces the message politely, styled by tone, and dismisses on click', async () => {
    const onDismiss = vi.fn();
    render(<PixelToast toast={{ id: 1, text: 'PGN COPIED TO CLIPBOARD', tone: 'success' }} onDismiss={onDismiss} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('PGN COPIED TO CLIPBOARD');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveClass('tone-success');
    await userEvent.click(toast);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('small label updates', () => {
  it('countdown: in a bot match your side says YOU and the other names the CPU', () => {
    const { container, rerender } = render(
      <CountdownOverlay countdownValue={3} gameMode="bot" difficulty="tough" playerColor="w" />
    );
    const sub = (side) => container.querySelector(`.intro-fighter-${side} .intro-sub`).textContent;
    expect(sub('red')).toBe('YOU');
    expect(sub('blue')).toBe('CPU TOUGH');

    rerender(<CountdownOverlay countdownValue={3} gameMode="bot" difficulty="easy" playerColor="b" />);
    expect(sub('red')).toBe('CPU EASY');
    expect(sub('blue')).toBe('YOU');

    rerender(<CountdownOverlay countdownValue={3} gameMode="1v1" difficulty={null} />);
    expect(sub('red')).toBe('PLAYER 1');
    expect(sub('blue')).toBe('PLAYER 2');
  });

  it('save cards show increment time controls as-is', () => {
    const match = { id: 'm', date: 'Nov 12', gameMode: '1v1', timeMode: '3+2', gameStatus: 'RED TURN' };
    render(<SaveSlotCard match={match} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('TIME: 3+2')).toBeInTheDocument();
  });
});
