import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PixelModal } from './PixelModal';

function renderModal(props = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <PixelModal
      title="[WARN MODULE]"
      message="DELETE THIS DATA SLOT PERMANENTLY?"
      confirmLabel="YES (ERASE)"
      cancelLabel="NO (KEEP)"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onConfirm, onCancel };
}

describe('PixelModal', () => {
  it('renders the title, message and both buttons inside a dialog', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: '[WARN MODULE]' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: '[WARN MODULE]' })).toBeInTheDocument();
    expect(screen.getByText('DELETE THIS DATA SLOT PERMANENTLY?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'YES (ERASE)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NO (KEEP)' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'YES (ERASE)' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'NO (KEEP)' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape closes the modal through onCancel', async () => {
    const { onCancel } = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape works even when no cancel button is shown', async () => {
    const { onCancel } = renderModal({ cancelLabel: undefined });
    expect(screen.queryByRole('button', { name: 'NO (KEEP)' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape does nothing when the modal cannot be cancelled', async () => {
    const { onConfirm } = renderModal({ onCancel: undefined, cancelLabel: undefined });
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('other keys do not close it', async () => {
    const { onCancel } = renderModal();
    await userEvent.keyboard('a');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('focuses the first button when it opens, so Enter confirms', async () => {
    const { onConfirm } = renderModal();
    expect(screen.getByRole('button', { name: 'YES (ERASE)' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('skips disabled buttons when choosing what to focus', () => {
    render(
      <PixelModal title="[PAUSE MENU]">
        <button type="button" disabled>
          RESTART
        </button>
        <button type="button">CONTINUE</button>
      </PixelModal>
    );
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toHaveFocus();
  });

  it('stops listening for Escape once it is closed', async () => {
    const onCancel = vi.fn();
    const { unmount } = render(<PixelModal title="T" onCancel={onCancel} />);
    unmount();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('applies the tone, the danger style and the scanline option', () => {
    const { rerender } = render(
      <PixelModal title="A" tone="alert" confirmLabel="DELETE" confirmVariant="danger" onConfirm={() => {}} />
    );
    expect(screen.getByRole('dialog')).toHaveClass('tone-alert', 'has-scanlines');
    expect(screen.getByRole('button', { name: 'DELETE' })).toHaveClass('pixel-modal-danger');

    rerender(<PixelModal title="A" scanlines={false} confirmLabel="OK" onConfirm={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveClass('tone-info');
    expect(screen.getByRole('dialog')).not.toHaveClass('has-scanlines');
    expect(screen.getByRole('button', { name: 'OK' })).toHaveClass('pixel-modal-confirm');
  });

  it('renders custom children and no action row when no labels are given', () => {
    render(
      <PixelModal title="[GAME OVER]" tone="gold">
        <p>WINNER: RED (P1)</p>
      </PixelModal>
    );
    expect(screen.getByText('WINNER: RED (P1)')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
