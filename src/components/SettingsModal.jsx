import { PixelModal } from './PixelModal';
import { BOARD_THEMES } from '../hooks/useSettings';

function VolumeSlider({ id, label, value, onChange }) {
  return (
    <div className="settings-row">
      <label htmlFor={id} className="settings-label">{label}</label>
      <input
        id={id}
        type="range"
        className="settings-slider"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className="settings-value">{value}</output>
    </div>
  );
}

function Toggle({ label, note, checked, onChange }) {
  return (
    <div className="settings-row">
      <span className="settings-label">
        {label}
        {note && <span className="settings-note">{note}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`settings-toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        {checked ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// Player preferences. Every change applies and is saved immediately.
export function SettingsModal({ settings, onChange, onReset, onClose }) {
  return (
    <PixelModal title="[SETTINGS]" onCancel={onClose} confirmLabel="DONE" onConfirm={onClose}>
      <div className="settings-panel">
        <VolumeSlider
          id="settings-music"
          label="MUSIC VOLUME"
          value={settings.musicVolume}
          onChange={(v) => onChange('musicVolume', v)}
        />
        <VolumeSlider
          id="settings-sfx"
          label="SFX VOLUME"
          value={settings.sfxVolume}
          onChange={(v) => onChange('sfxVolume', v)}
        />
        <Toggle
          label="ANIMATIONS"
          note="TURN OFF ON SLOW PHONES"
          checked={settings.animations}
          onChange={(v) => onChange('animations', v)}
        />
        <Toggle
          label="SCREEN FX"
          note="SCANLINES, STARS, FLASHES"
          checked={settings.screenFx}
          onChange={(v) => onChange('screenFx', v)}
        />

        <div className="settings-row settings-row-stacked">
          <span className="settings-label" id="settings-theme-label">BOARD THEME</span>
          <div className="settings-themes" role="radiogroup" aria-labelledby="settings-theme-label">
            {Object.entries(BOARD_THEMES).map(([id, theme]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={settings.boardTheme === id}
                className={`settings-theme ${settings.boardTheme === id ? 'is-active' : ''}`}
                onClick={() => onChange('boardTheme', id)}
              >
                <span className="theme-swatch" aria-hidden="true">
                  <span style={{ background: theme.light }} />
                  <span style={{ background: theme.dark }} />
                  <span style={{ background: theme.dark }} />
                  <span style={{ background: theme.light }} />
                </span>
                {theme.name}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="settings-reset" onClick={onReset}>
          RESET TO DEFAULTS
        </button>
      </div>
    </PixelModal>
  );
}
