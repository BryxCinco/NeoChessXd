import { useEffect, useRef } from 'react';

// Reusable retro dialog: chunky border, pixel font, optional scanlines.
//
//   <PixelModal title="[WARN MODULE]" tone="alert" message="DELETE THIS SLOT?"
//     confirmLabel="YES (ERASE)" confirmVariant="danger" onConfirm={...}
//     cancelLabel="NO (KEEP)" onCancel={...} />
//
// - `tone`: 'info' (cyan) | 'alert' (red) | 'gold' — colours the title + border.
// - `message` is the body text; `children` render under it (custom content
//   such as the pause-menu button grid).
// - A button only renders when its label is given. Escape calls `onCancel`
//   (even without a cancel button), so every modal can be dismissed by
//   keyboard; the first button is focused when the modal opens.
export function PixelModal({
  title,
  tone = 'info',
  message,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  scanlines = true,
}) {
  const bodyRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const first = bodyRef.current?.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape' && onCancelRef.current) {
        e.stopPropagation();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const confirmClass = confirmVariant === 'danger' ? 'pixel-modal-danger' : 'pixel-modal-confirm';

  return (
    <div className="retro-modal-overlay">
      <div
        ref={bodyRef}
        className={`bento-pixel retro-modal-body pixel-modal tone-${tone} ${scanlines ? 'has-scanlines' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && <h2 className="modal-title-pixel">{title}</h2>}
        {message && <p className="modal-text-pixel">{message}</p>}
        {children}
        {(confirmLabel || cancelLabel) && (
          <div className="btn-group-pixel pixel-modal-actions">
            {confirmLabel && (
              <button type="button" className={confirmClass} onClick={onConfirm}>
                {confirmLabel}
              </button>
            )}
            {cancelLabel && (
              <button type="button" className="cancel-modal-btn" onClick={onCancel}>
                {cancelLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
