// Small pop-up message at the top of the screen ("PGN COPIED" ...).
// `toast` comes from useToast(): { id, text, tone } or null.
export function PixelToast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="pixel-toast-layer">
      <button
        key={toast.id}
        type="button"
        role="status"
        aria-live="polite"
        className={`pixel-toast tone-${toast.tone}`}
        onClick={onDismiss}
      >
        {toast.text}
      </button>
    </div>
  );
}
