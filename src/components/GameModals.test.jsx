import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameModals } from './GameModals';

function renderModals(activeModal, extra = {}) {
  const props = {
    activeModal,
    gameStatus: 'RED TURN',
    isAnimatingMove: false,
    pendingPromotion: null,
    pendingLoadMatch: null,
    play: vi.fn(),
    onClose: vi.fn(),
    onOpenQuitConfirm: vi.fn(),
    onRestart: vi.fn(),
    onSave: vi.fn(),
    onConfirmOverwrite: vi.fn(),
    onConfirmLoad: vi.fn(),
    onConfirmQuit: vi.fn(),
    onConfirmDelete: vi.fn(),
    ...extra,
  };
  const view = render(<GameModals {...props} />);
  return { ...view, props };
}

const click = (name) => userEvent.click(screen.getByRole('button', { name }));

describe('GameModals', () => {
  it('renders nothing when no modal is active or the name is unknown', () => {
    expect(renderModals(null).container).toBeEmptyDOMElement();
    expect(renderModals('no_such_modal').container).toBeEmptyDOMElement();
  });

  it('pause menu: every action is wired up', async () => {
    const { props } = renderModals('pause_menu');
    expect(screen.getByRole('dialog', { name: '[PAUSE MENU]' })).toBeInTheDocument();

    await click(/CONTINUE/);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await click(/RESTART/);
    expect(props.onRestart).toHaveBeenCalledTimes(1);
    await click(/SAVE GAME/);
    expect(props.onSave).toHaveBeenCalledWith(); // never handed the click event
    await click(/OUT/);
    expect(props.onOpenQuitConfirm).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('pause menu: restart / save / quit are disabled while a move is animating', () => {
    renderModals('pause_menu', { isAnimatingMove: true });
    expect(screen.getByRole('button', { name: /CONTINUE/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /RESTART/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /SAVE GAME/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /OUT/ })).toBeDisabled();
  });

  it('save success: OK closes it', async () => {
    const { props } = renderModals('save_success');
    expect(screen.getByText('GAME SAVED SUCCESSFULLY!')).toBeInTheDocument();
    await click('OK (CONTINUE)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.play).toHaveBeenCalledWith('click');
  });

  it('save failed: explains that storage is full or blocked', async () => {
    const { props } = renderModals('save_failed');
    expect(screen.getByRole('dialog')).toHaveClass('tone-alert');
    expect(screen.getByText('SAVE FAILED — STORAGE FULL OR BLOCKED')).toBeInTheDocument();
    await click('OK');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('overwrite warning: YES overwrites, NO cancels', async () => {
    const { props } = renderModals('confirm_overwrite');
    expect(screen.getByText('ALL 10 SAVE SLOTS ARE USED. OVERWRITE THE OLDEST SAVE?')).toBeInTheDocument();
    await click('YES (OVERWRITE)');
    expect(props.onConfirmOverwrite).toHaveBeenCalledTimes(1);
    await click('NO (CANCEL)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('load confirmation: names the save, YES loads, NO cancels', async () => {
    const { props } = renderModals('confirm_load', {
      pendingLoadMatch: { gameMode: 'bot', difficulty: 'hard', date: 'Nov 12, 10:00:00 AM' },
    });
    expect(screen.getByText('LOAD THIS SAVED MATCH?')).toBeInTheDocument();
    expect(screen.getByText('CPU (HARD) · Nov 12, 10:00:00 AM')).toBeInTheDocument();
    await click('YES (LOAD)');
    expect(props.onConfirmLoad).toHaveBeenCalledTimes(1);
    await click('NO (CANCEL)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('load confirmation: describes a local match, and copes with no match info', () => {
    const { rerender, props } = renderModals('confirm_load', {
      pendingLoadMatch: { gameMode: '1v1', date: 'Nov 11' },
    });
    expect(screen.getByText('1VS1 · Nov 11')).toBeInTheDocument();
    rerender(<GameModals {...props} pendingLoadMatch={{ gameMode: 'bot', date: 'Nov 10' }} />);
    expect(screen.getByText('CPU () · Nov 10')).toBeInTheDocument();
    rerender(<GameModals {...props} pendingLoadMatch={null} />);
    expect(screen.getByText('LOAD THIS SAVED MATCH?')).toBeInTheDocument();
  });

  it('load failed: OK closes it', async () => {
    const { props } = renderModals('load_failed');
    expect(screen.getByText(/FAILED TO READ THIS SAVE SLOT/)).toBeInTheDocument();
    await click('OK');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('quit confirmation: YES quits, NO cancels', async () => {
    const { props } = renderModals('confirm_quit');
    await click('YES (QUIT)');
    expect(props.onConfirmQuit).toHaveBeenCalledTimes(1);
    await click('NO (CANCEL)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('delete confirmation: YES erases, NO and Escape keep the slot', async () => {
    const { props } = renderModals('confirm_delete');
    expect(screen.getByText('DELETE THIS DATA SLOT PERMANENTLY?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'YES (ERASE)' })).toHaveClass('pixel-modal-danger');

    await click('NO (KEEP)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirmDelete).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(2);
    expect(props.onConfirmDelete).not.toHaveBeenCalled();

    await click('YES (ERASE)');
    expect(props.onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['WINNER: RED (P1)', 1],
    ['TIME OUT - WINNER: BLUE (P2 / CPU)', 1],
    ['DRAW - STALEMATE', 2],
  ])('game over "%s": shows the result with %i king sprite(s)', async (gameStatus, kings) => {
    const { props, container } = renderModals('game_over', { gameStatus });
    expect(screen.getByRole('dialog', { name: '[GAME OVER]' })).toHaveClass('tone-gold');
    expect(screen.getByText(gameStatus)).toBeInTheDocument();
    expect(container.querySelectorAll('.game-over-hero svg')).toHaveLength(kings);

    await click(/REPLAY/);
    expect(props.onRestart).toHaveBeenCalledTimes(1);
    await click(/MAIN MENU/);
    expect(props.onConfirmQuit).toHaveBeenCalledTimes(1);

    // The result must be acknowledged with a button: Escape does not dismiss it.
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
