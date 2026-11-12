import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chess } from 'chess.js';
import { GameBoardScreen } from './GameBoardScreen';
import { MoveScoresheet } from './MoveScoresheet';
import { PlayerBar } from './PlayerBar';
import { PromotionModal } from './PromotionModal';
import { CountdownOverlay } from './CountdownOverlay';
import { PixelLogo } from './PixelLogo';
import { pixelPieces } from '../boardPieces';
import { PieceSprite } from '../pixelPieces';

// react-chessboard needs real layout + drag-and-drop; the board itself is
// replaced by a stand-in that just exposes the props it was given.
let boardProps = null;
vi.mock('react-chessboard', () => ({
  Chessboard: (props) => {
    boardProps = props;
    return <div data-testid="board" />;
  },
}));

const formatTime = (s) => `T${Math.ceil(s)}`;

function screenProps(extra = {}) {
  return {
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
    gameMode: '1v1',
    timeMode: 'none',
    whiteTime: 600,
    blackTime: 600,
    formatTime,
    moveHistory: [],
    lastMove: null,
    isCompactLayout: false,
    isGameOver: false,
    ...extra,
  };
}

describe('GameBoardScreen', () => {
  it('passes the position, size and handlers to the board', () => {
    const props = screenProps({ customSquareStyles: { e4: { color: 'red' } } });
    render(<GameBoardScreen {...props} />);
    expect(screen.getByTestId('board')).toBeInTheDocument();
    expect(boardProps).toMatchObject({
      boardWidth: 400,
      position: props.displayPosition,
      onPieceDrop: props.onDrop,
      onSquareClick: props.onSquareClick,
      onPieceDragBegin: props.onPieceDragBegin,
      isDraggablePiece: props.isDraggablePiece,
      customSquareStyles: { e4: { color: 'red' } },
      customPieces: pixelPieces,
    });
    expect(props.canvasRef.current).toBeInstanceOf(HTMLCanvasElement);
    expect(props.boardWrapperRef.current).toContainElement(screen.getByTestId('board'));
  });

  it('local match: plain player names, status and stage, no clocks', () => {
    const { container } = render(<GameBoardScreen {...screenProps()} />);
    expect(screen.getByText('P1 RED')).toBeInTheDocument();
    expect(screen.getByText('P2 BLUE')).toBeInTheDocument();
    expect(screen.getByText('RED TURN')).toHaveClass('blinking-text');
    expect(screen.getByText('STAGE: WORLD 1v1 LOCAL')).toBeInTheDocument();
    expect(container.querySelector('.player-bar-clock')).not.toBeInTheDocument();
    expect(container.querySelector('.player-bar-w')).toHaveClass('is-active'); // white to move
    expect(container.querySelector('.player-bar-b')).not.toHaveClass('is-active');
  });

  it('bot match: labels YOU / CPU and shows the thinking state', () => {
    const game = new Chess();
    game.move('e4');
    const { container } = render(<GameBoardScreen {...screenProps({ gameMode: 'bot', botThinking: true, game })} />);
    expect(screen.getByText('P1 RED (YOU)')).toBeInTheDocument();
    expect(screen.getByText(/P2 BLUE \(CPU\)/)).toBeInTheDocument();
    expect(screen.getByText('THINKING')).toBeInTheDocument();
    expect(screen.getByText('CPU THINKING...')).toBeInTheDocument();
    expect(screen.getByText('STAGE: WORLD CPU BOT')).toBeInTheDocument();
    expect(container.querySelector('.player-bar-b')).toHaveClass('is-active');
  });

  it('timed match: shows both clocks and flags the one that is running low', () => {
    const { container } = render(
      <GameBoardScreen {...screenProps({ timeMode: '5', whiteTime: 12.3, blackTime: 250 })} />
    );
    const whiteClock = container.querySelector('.player-bar-w .player-bar-clock');
    const blackClock = container.querySelector('.player-bar-b .player-bar-clock');
    expect(whiteClock).toHaveTextContent('T13');
    expect(whiteClock).toHaveClass('is-low', 'is-running');
    expect(blackClock).toHaveTextContent('T250');
    expect(blackClock).not.toHaveClass('is-low');
    expect(blackClock).not.toHaveClass('is-running');
  });

  it('shows captured pieces and who is ahead', () => {
    const { container } = render(
      <GameBoardScreen {...screenProps({ captured: { w: ['q', 'p', 'p'], b: ['n'], material: 8 } })} />
    );
    const red = container.querySelector('.player-bar-w');
    const blue = container.querySelector('.player-bar-b');
    expect(red.querySelectorAll('.captured-piece')).toHaveLength(3);
    expect(red.querySelectorAll('.captured-piece.is-stacked')).toHaveLength(1); // the second pawn
    expect(within(red).getByText('+8')).toBeInTheDocument();
    expect(blue.querySelectorAll('.captured-piece')).toHaveLength(1);
    expect(blue.querySelector('.material-lead')).not.toBeInTheDocument();
    expect(within(red).getByLabelText('Captured pieces: 3')).toBeInTheDocument();
  });

  it('checkmate: shakes the board, shows the banner, stops the status blinking', () => {
    const { container } = render(
      <GameBoardScreen {...screenProps({ checkmateFx: true, isGameOver: true, gameStatus: 'WINNER: RED (P1)' })} />
    );
    expect(container.querySelector('.board-frame')).toHaveClass('board-shake');
    expect(screen.getByRole('status')).toHaveTextContent('CHECKMATE!');
    expect(container.querySelector('.monitor-badge')).not.toHaveClass('blinking-text');
    expect(container.querySelector('.player-bar.is-active')).not.toBeInTheDocument();
  });
});

describe('MoveScoresheet', () => {
  const rows = [
    { number: 1, white: 'e4', black: 'e5' },
    { number: 2, white: 'Nf3', black: 'Nc6' },
    { number: 3, white: 'Bb5', black: null },
  ];

  it('shows a placeholder before the first move', () => {
    render(<MoveScoresheet moveHistory={[]} lastMove={null} gameStatus="RED TURN" isCompactLayout={false} />);
    expect(screen.getByText('No moves yet...')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('lists the moves in order, numbered, with "..." for a reply not yet played', () => {
    const { container } = render(
      <MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="BLUE TURN" isCompactLayout={false} />
    );
    const cells = [...container.querySelectorAll('.scoresheet-body span')].map((s) => s.textContent);
    expect(cells).toEqual(['1.', 'e4', 'e5', '2.', 'Nf3', 'Nc6', '3.', 'Bb5', '...']);
    expect(screen.getByText('3 moves')).toBeInTheDocument();
  });

  it('highlights only the last move played', () => {
    const { rerender } = render(
      <MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="BLUE TURN" isCompactLayout />
    );
    expect(screen.getByText('Bb5').style.fontWeight).toBe('bold');
    expect(screen.getByText('Nc6').style.fontWeight).toBe('normal');

    const withReply = [...rows.slice(0, 2), { number: 3, white: 'Bb5', black: 'a6' }];
    rerender(<MoveScoresheet moveHistory={withReply} lastMove="a6" gameStatus="RED TURN" isCompactLayout />);
    expect(screen.getByText('a6').style.fontWeight).toBe('bold');
    expect(screen.getByText('Bb5').style.fontWeight).toBe('normal');
  });

  it('adds the result line when the game is over', () => {
    const { rerender } = render(
      <MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="WINNER: RED (P1)" isCompactLayout={false} />
    );
    expect(screen.getByText('RED (P1)')).toBeInTheDocument();
    rerender(<MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="DRAW - STALEMATE" isCompactLayout={false} />);
    expect(screen.getByText('DRAW - STALEMATE')).toBeInTheDocument();
    rerender(<MoveScoresheet moveHistory={rows} lastMove="Bb5" gameStatus="BLUE TURN" isCompactLayout={false} />);
    expect(screen.queryByText('BLUE TURN')).not.toBeInTheDocument();
  });
});

describe('PlayerBar', () => {
  it('shows NO CAPTURES and hides the clock in an untimed game', () => {
    const { container } = render(
      <PlayerBar color="w" label="P1 RED" isActive={false} isThinking={false} capturedTypes={[]} materialLead={0} timeText={null} isLowTime={false} />
    );
    expect(screen.getByText('NO CAPTURES')).toBeInTheDocument();
    expect(container.querySelector('.player-bar-clock')).not.toBeInTheDocument();
  });
});

describe('PromotionModal', () => {
  it('offers queen, rook, bishop and knight and reports the choice', async () => {
    const onSelect = vi.fn();
    render(<PromotionModal color="b" onSelect={onSelect} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Choose a piece to promote to' })).toHaveClass('promo-modal-b');
    for (const name of ['QUEEN', 'ROOK', 'BISHOP', 'KNIGHT']) await userEvent.click(screen.getByRole('button', { name }));
    expect(onSelect.mock.calls.flat()).toEqual(['q', 'r', 'b', 'n']);
  });

  it('supports the Q / R / B / N keys and Escape', async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<PromotionModal onSelect={onSelect} onCancel={onCancel} />);
    await userEvent.keyboard('qRbn');
    expect(onSelect.mock.calls.flat()).toEqual(['q', 'r', 'b', 'n']);
    await userEvent.keyboard('x');
    expect(onSelect).toHaveBeenCalledTimes(4);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('CANCEL MOVE and clicking outside cancel; clicking inside does not', async () => {
    const onCancel = vi.fn();
    const { container } = render(<PromotionModal onSelect={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('PAWN PROMOTION!'));
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /CANCEL MOVE/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(container.querySelector('.retro-modal-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

describe('CountdownOverlay', () => {
  it('shows the count, the two armies and a tip', () => {
    const { container, rerender } = render(<CountdownOverlay countdownValue={3} gameMode="1v1" difficulty={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('3');
    expect(screen.getByText('RED ARMY')).toBeInTheDocument();
    expect(screen.getByText('PLAYER 2')).toBeInTheDocument();
    expect(screen.getByText(/^TIP: /)).toBeInTheDocument();
    expect(container.querySelectorAll('.intro-loadbar .is-filled')).toHaveLength(2);

    rerender(<CountdownOverlay countdownValue="GO!" gameMode="1v1" difficulty={null} />);
    expect(container.querySelector('.intro-count')).toHaveClass('is-go');
    expect(container.querySelectorAll('.intro-loadbar .is-filled')).toHaveLength(8);
  });

  it('names the CPU by difficulty (medium is shown as NORMAL)', () => {
    const { rerender } = render(<CountdownOverlay countdownValue={2} gameMode="bot" difficulty="medium" />);
    expect(screen.getByText('CPU NORMAL')).toBeInTheDocument();
    rerender(<CountdownOverlay countdownValue={2} gameMode="bot" difficulty="hard" />);
    expect(screen.getByText('CPU HARD')).toBeInTheDocument();
  });
});

describe('PixelLogo and piece sprites', () => {
  it('the logo is one labelled heading by default, or any other tag', () => {
    const { rerender } = render(<PixelLogo />);
    expect(screen.getByRole('heading', { level: 1, name: 'Neo Chess DX' })).toHaveClass('pixel-logo-lg');
    rerender(<PixelLogo size="sm" as="div" />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Neo Chess DX')).toHaveClass('pixel-logo-sm');
  });

  it('there is a board piece renderer for all 12 pieces', () => {
    expect(Object.keys(pixelPieces).sort()).toEqual(
      ['bB', 'bK', 'bN', 'bP', 'bQ', 'bR', 'wB', 'wK', 'wN', 'wP', 'wQ', 'wR']
    );
    const Knight = pixelPieces.wN;
    const { container } = render(<Knight squareWidth={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.pixel-piece')).toBeInTheDocument(); // animated on the board
  });

  it('an unknown piece code renders nothing', () => {
    const { container } = render(<PieceSprite code="zZ" size={20} />);
    expect(container).toBeEmptyDOMElement();
  });
});
