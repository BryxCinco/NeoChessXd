import { PixelModal } from './PixelModal';
import { BOARD_THEMES } from '../hooks/useSettings';
import { PIECE_SKINS } from '../pieceSkins.js';
import { PieceSprite } from '../pixelPieces';
import { listEffects } from '../effects/index.js';

function VolumeSlider({ id, label, note, value, onChange, disabled = false }) {
  return (
    <div className="settings-row">
      <label htmlFor={id} className="settings-label">
        {label}
        {note && <span className="settings-note">{note}</span>}
      </label>
      <input
        id={id}
        type="range"
        className="settings-slider"
        min="0"
        max="100"
        step="5"
        value={value}
        disabled={disabled}
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

const TRIGGER_LABEL = { capture: 'CAPTURE', checkmate: 'CHECKMATE', promotion: 'PROMOTION', check: 'CHECK', move: 'MOVE', theme_change: 'THEME CHANGE' };

// Master switch, capture-effect chooser, intensity, and one switch per effect.
function EffectsSection({ settings, onChange, onToggleEffect }) {
  const effects = listEffects();
  const captureEffects = effects.filter((e) => e.trigger === 'capture');
  const off = settings.disabledEffects || [];
  const enabled = settings.effectsEnabled;
  const onCount = effects.filter((e) => !off.includes(e.id)).length;

  return (
    <section className="settings-section" aria-labelledby="settings-effects-title">
      <h3 className="settings-section-title" id="settings-effects-title">EFFECTS</h3>
      <Toggle
        label="ALL EFFECTS"
        note="OFF = FASTEST, FOR SLOW PHONES"
        checked={enabled}
        onChange={(v) => onChange('effectsEnabled', v)}
      />
      <div className="settings-row">
        <label htmlFor="settings-capture-effect" className="settings-label">
          CAPTURE EFFECT
          <span className="settings-note">RANDOM, OR ALWAYS THE SAME ONE</span>
        </label>
        <select
          id="settings-capture-effect"
          className="settings-select"
          value={settings.captureEffect}
          disabled={!enabled}
          onChange={(e) => onChange('captureEffect', e.target.value)}
        >
          <option value="random">RANDOM</option>
          {captureEffects.map((e) => (
            <option key={e.id} value={e.id} disabled={off.includes(e.id)}>
              {e.name}{e.attackers ? ` (${e.attackers.map((a) => PIECE_NAME[a]).join('/')})` : ''}
            </option>
          ))}
        </select>
      </div>
      <VolumeSlider
        id="settings-intensity"
        label="EFFECT INTENSITY"
        note="FEWER PARTICLES = FASTER"
        value={settings.effectIntensity}
        disabled={!enabled}
        onChange={(v) => onChange('effectIntensity', v)}
      />
      <details className="settings-effects">
        <summary>EFFECT LIST ({onCount}/{effects.length} ON)</summary>
        <div className="settings-effect-grid">
          {effects.map((e) => {
            const on = !off.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={e.name}
                title={`${TRIGGER_LABEL[e.trigger]} EFFECT`}
                disabled={!enabled}
                className={`settings-effect ${on ? 'is-on' : ''}`}
                onClick={() => onToggleEffect(e.id, !on)}
              >
                <span className="settings-effect-led" aria-hidden="true" />
                {e.name}
              </button>
            );
          })}
        </div>
      </details>
    </section>
  );
}
const PIECE_NAME = { p: 'PAWN', n: 'KNIGHT', b: 'BISHOP', r: 'ROOK', q: 'QUEEN', k: 'KING' };

// Player preferences. Every change applies and is saved immediately.
export function SettingsModal({ settings, onChange, onToggleEffect = () => {}, onReset, onClose }) {
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

        <div className="settings-row settings-row-stacked">
          <span className="settings-label" id="settings-skin-label">PIECE SKIN</span>
          <div className="settings-themes settings-skins" role="radiogroup" aria-labelledby="settings-skin-label">
            {Object.values(PIECE_SKINS).map((skin) => (
              <button
                key={skin.id}
                type="button"
                role="radio"
                aria-checked={settings.pieceSkin === skin.id}
                title={skin.description}
                className={`settings-theme settings-skin ${settings.pieceSkin === skin.id ? 'is-active' : ''}`}
                onClick={() => onChange('pieceSkin', skin.id)}
              >
                <span className="skin-preview" aria-hidden="true">
                  <span style={{ background: BOARD_THEMES[settings.boardTheme].light }}>
                    <PieceSprite code="wK" size={28} skin={skin.id} />
                  </span>
                  <span style={{ background: BOARD_THEMES[settings.boardTheme].dark }}>
                    <PieceSprite code="bK" size={28} skin={skin.id} />
                  </span>
                </span>
                {skin.name}
              </button>
            ))}
          </div>
        </div>

        <EffectsSection settings={settings} onChange={onChange} onToggleEffect={onToggleEffect} />

        <button type="button" className="settings-reset" onClick={onReset}>
          RESET TO DEFAULTS
        </button>
      </div>
    </PixelModal>
  );
}
