import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameModals } from './GameModals';
import { DEFAULT_SETTINGS } from '../hooks/useSettings';

function renderModals(activeModal, extra = {}) {
  const props = {
    activeModal,
    isAnimatingMove: false,
    pendingPromotion: null,
    pendingLoadMatch: null,
    pendingDrawOffer: null,
    canEndManually: true,
    gameMode: '1v1',
    settings: { ...DEFAULT_SETTINGS },
    play: vi.fn(),
    onClose: vi.fn(),
    onOpenModal: vi.fn(),
    onRestart: vi.fn(),
    onSave: vi.fn(),
    onConfirmOverwrite: vi.fn(),
    onConfirmLoad: vi.fn(),
    onConfirmQuit: vi.fn(),
    onConfirmDelete: vi.fn(),
    onConfirmResign: vi.fn(),
    onOfferDraw: vi.fn(),
    onAnswerDraw: vi.fn(),
    onCopyPgn: vi.fn(),
    onDownloadPgn: vi.fn(),
    onChangeSetting: vi.fn(),
    onResetSettings: vi.fn(),
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

  it('game over is not a modal any more (the board must stay visible)', () => {
    expect(renderModals('game_over').container).toBeEmptyDOMElement();
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
    await click(/OFFER DRAW/);
    expect(props.onOfferDraw).toHaveBeenCalledTimes(1);
    await click(/RESIGN/);
    expect(props.onOpenModal).toHaveBeenLastCalledWith('confirm_resign'); // asks first
    expect(props.onConfirmResign).not.toHaveBeenCalled();
    await click(/COPY PGN/);
    expect(props.onCopyPgn).toHaveBeenCalledTimes(1);
    await click(/DOWNLOAD PGN/);
    expect(props.onDownloadPgn).toHaveBeenCalledTimes(1);
    await click(/SETTINGS/);
    expect(props.onOpenModal).toHaveBeenLastCalledWith('settings');
    await click(/OUT/);
    expect(props.onOpenModal).toHaveBeenLastCalledWith('confirm_quit');

    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('pause menu: game-changing actions are disabled while a move is animating', () => {
    renderModals('pause_menu', { isAnimatingMove: true });
    expect(screen.getByRole('button', { name: /CONTINUE/ })).toBeEnabled();
    for (const name of [/RESTART/, /SAVE GAME/, /OFFER DRAW/, /RESIGN/, /OUT/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /COPY PGN/ })).toBeEnabled();
  });

  it('pause menu: resign and draw are disabled once the game is over', () => {
    renderModals('pause_menu', { canEndManually: false });
    expect(screen.getByRole('button', { name: /OFFER DRAW/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /RESIGN/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /RESTART/ })).toBeEnabled();
  });

  it('resign confirmation: YES resigns, NO keeps playing', async () => {
    const { props, rerender } = renderModals('confirm_resign');
    expect(screen.getByText('GIVE UP THIS MATCH? YOUR OPPONENT WINS.')).toBeInTheDocument();
    await click('NO (KEEP PLAYING)');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirmResign).not.toHaveBeenCalled();
    await click('YES (RESIGN)');
    expect(props.onConfirmResign).toHaveBeenCalledTimes(1);

    rerender(<GameModals {...props} gameMode="bot" />);
    expect(screen.getByText('GIVE UP THIS MATCH? THE CPU WINS.')).toBeInTheDocument();
  });

  it('draw offer (1v1): names both sides and passes on the answer', async () => {
    const { props, rerender } = renderModals('draw_offer', { pendingDrawOffer: 'w' });
    expect(screen.getByText('RED OFFERS A DRAW. BLUE, DO YOU ACCEPT?')).toBeInTheDocument();
    await click('ACCEPT DRAW');
    expect(props.onAnswerDraw).toHaveBeenLastCalledWith(true);
    await click('DECLINE');
    expect(props.onAnswerDraw).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard('{Escape}'); // Escape = decline
    expect(props.onAnswerDraw).toHaveBeenCalledTimes(3);
    expect(props.onAnswerDraw).toHaveBeenLastCalledWith(false);

    rerender(<GameModals {...props} pendingDrawOffer="b" />);
    expect(screen.getByText('BLUE OFFERS A DRAW. RED, DO YOU ACCEPT?')).toBeInTheDocument();
  });

  it('settings: shows the settings screen and closes with DONE', async () => {
    const { props } = renderModals('settings');
    expect(screen.getByRole('dialog', { name: '[SETTINGS]' })).toBeInTheDocument();
    await click('DONE');
    expect(props.onClose).toHaveBeenCalledTimes(1);
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
});
