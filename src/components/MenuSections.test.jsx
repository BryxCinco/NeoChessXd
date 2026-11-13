import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AudioToggleButton,
  StartSelectionSection,
  LoadGameSection,
  ModeSelectionSection,
  DifficultySelectionSection,
  PlayAsSection,
  SettingsButton,
  TimeSelectionSection,
  SavedMatchesPanel,
} from './MenuSections';
import { StartMenuScreen } from './StartMenuScreen';

describe('AudioToggleButton', () => {
  it('is a type="button" (so it can never submit a form) and shows the state', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<AudioToggleButton isMuted={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'AUDIO: ON' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveClass('is-muted');

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<AudioToggleButton isMuted onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'AUDIO: OFF' })).toHaveClass('is-muted');
  });
});

describe('menu sections', () => {
  it('main menu offers NEW GAME and LOAD GAME', async () => {
    const onNewGame = vi.fn();
    const onLoadGame = vi.fn();
    render(<StartSelectionSection onNewGame={onNewGame} onLoadGame={onLoadGame} />);
    await userEvent.click(screen.getByRole('button', { name: /NEW GAME/ }));
    await userEvent.click(screen.getByRole('button', { name: /LOAD GAME/ }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onLoadGame).toHaveBeenCalledTimes(1);
  });

  it('mode selection reports the chosen mode and marks it active', async () => {
    const onSelect = vi.fn();
    render(<ModeSelectionSection gameMode="bot" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /BOT MATCH/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /1 VS 1 LOCAL/ })).not.toHaveClass('active');
    await userEvent.click(screen.getByRole('button', { name: /1 VS 1 LOCAL/ }));
    await userEvent.click(screen.getByRole('button', { name: /BOT MATCH/ }));
    expect(onSelect.mock.calls).toEqual([['1v1'], ['bot']]);
  });

  it('difficulty selection reports easy / medium / tough / hard', async () => {
    const onSelect = vi.fn();
    render(<DifficultySelectionSection difficulty="medium" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'NORMAL' })).toHaveClass('active');
    for (const name of ['EASY', 'NORMAL', 'TOUGH', 'HARD CORE']) await userEvent.click(screen.getByRole('button', { name }));
    expect(onSelect.mock.calls).toEqual([['easy'], ['medium'], ['tough'], ['hard']]);
  });

  it('time selection reports every preset (with increments), and is step 05 for bot matches / 03 for local', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<TimeSelectionSection gameMode="bot" timeMode="5" onSelect={onSelect} />);
    expect(screen.getByText('05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '05:00' })).toHaveClass('active');
    for (const name of ['NO LIMIT', '00:30', '01:00', '3+2', '05:00', '5+3', '10+0', '15+10', '30:00']) {
      await userEvent.click(screen.getByRole('button', { name }));
    }
    expect(onSelect.mock.calls.flat()).toEqual(['none', '0.5', '1', '3+2', '5', '5+3', '10', '15+10', '30']);

    rerender(<TimeSelectionSection gameMode="1v1" timeMode="none" onSelect={onSelect} />);
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NO LIMIT' })).toHaveClass('active');
  });

  it('side selection offers RED / BLUE / RANDOM and marks the current choice', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PlayAsSection colorChoice="w" onSelect={onSelect} />);
    expect(screen.getByRole('group', { name: 'Choose your side' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PLAY AS RED/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /PLAY AS BLUE/ })).toHaveAttribute('aria-pressed', 'false');

    for (const name of [/PLAY AS RED/, /PLAY AS BLUE/, /RANDOM/]) await userEvent.click(screen.getByRole('button', { name }));
    expect(onSelect.mock.calls.flat()).toEqual(['w', 'b', 'random']);

    rerender(<PlayAsSection colorChoice="random" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /RANDOM/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /PLAY AS RED/ })).not.toHaveClass('active');
  });

  it('the settings button opens the settings', async () => {
    const onOpen = vi.fn();
    render(<SettingsButton onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the load section and the desktop save panel list the saved matches', () => {
    const saves = [{ id: 'match_1', date: 'Nov 12', gameMode: '1v1', timeMode: 'none', gameStatus: 'RED TURN' }];
    const { rerender } = render(<LoadGameSection savedMatches={saves} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('DATE: Nov 12')).toBeInTheDocument();

    rerender(<SavedMatchesPanel savedMatches={[]} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('[SAVED MATCHES DATA]')).toBeInTheDocument();
    expect(screen.getByText('-- NO CURRENT DATA FOUND --')).toBeInTheDocument();
  });
});

describe('StartMenuScreen', () => {
  const baseProps = () => ({
    isCompactLayout: false,
    isMuted: false,
    onToggleAudio: vi.fn(),
    onOpenSettings: vi.fn(),
    colorChoice: 'w',
    onSelectColor: vi.fn(),
    menuStep: 'start',
    wizardTotalSteps: 3,
    wizardCurrentStepNumber: 1,
    gameMode: null,
    difficulty: null,
    timeMode: null,
    savedMatches: [],
    onNewGame: vi.fn(),
    onLoadGame: vi.fn(),
    onResume: vi.fn(),
    onDelete: vi.fn(),
    onSelectMode: vi.fn(),
    onSelectDifficulty: vi.fn(),
    onSelectTime: vi.fn(),
    onNextStep: vi.fn(),
    onPrevStep: vi.fn(),
    onStartGame: vi.fn(),
  });

  it('desktop: shows everything on one page and only enables START when the setup is complete', async () => {
    const props = baseProps();
    const { rerender } = render(<StartMenuScreen {...props} />);
    expect(screen.getByText('[SAVED MATCHES DATA]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'EASY' })).not.toBeInTheDocument(); // no difficulty until BOT is picked
    expect(screen.queryByRole('button', { name: /PLAY AS BLUE/ })).not.toBeInTheDocument(); // nor a side
    expect(screen.getByRole('button', { name: 'PUSH START BUTTON' })).toBeDisabled();

    rerender(<StartMenuScreen {...props} gameMode="bot" timeMode="5" />);
    expect(screen.getByRole('button', { name: 'EASY' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /PLAY AS BLUE/ }));
    expect(props.onSelectColor).toHaveBeenCalledWith('b');
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PUSH START BUTTON' })).toBeDisabled(); // still needs a difficulty

    rerender(<StartMenuScreen {...props} gameMode="bot" difficulty="easy" timeMode="5" />);
    await userEvent.click(screen.getByRole('button', { name: 'PUSH START BUTTON' }));
    expect(props.onStartGame).toHaveBeenCalledTimes(1);

    rerender(<StartMenuScreen {...props} gameMode="1v1" timeMode="none" />);
    expect(screen.getByRole('button', { name: 'PUSH START BUTTON' })).toBeEnabled(); // local needs no difficulty
  });

  it('compact wizard: start step has no BACK button and shows the progress dots', () => {
    const { container } = render(<StartMenuScreen {...baseProps()} isCompactLayout />);
    expect(screen.getByRole('button', { name: /NEW GAME/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /BACK/ })).not.toBeInTheDocument();
    const dots = [...container.querySelectorAll('.wizard-progress-dot')].map((d) => d.className);
    expect(dots).toEqual([
      'wizard-progress-dot active',
      'wizard-progress-dot pending',
      'wizard-progress-dot pending',
    ]);
  });

  it('compact wizard: NEXT is disabled until the step is answered', async () => {
    const props = { ...baseProps(), isCompactLayout: true, menuStep: 'mode', wizardCurrentStepNumber: 2 };
    const { rerender, container } = render(<StartMenuScreen {...props} />);
    expect(screen.getByRole('button', { name: /NEXT/ })).toBeDisabled();
    expect(container.querySelector('.wizard-progress-dot.done')).toBeInTheDocument();

    rerender(<StartMenuScreen {...props} gameMode="bot" />);
    await userEvent.click(screen.getByRole('button', { name: /NEXT/ }));
    expect(props.onNextStep).toHaveBeenCalledTimes(1);

    rerender(<StartMenuScreen {...props} gameMode="bot" menuStep="difficulty" wizardCurrentStepNumber={3} />);
    expect(screen.getByRole('button', { name: /NEXT/ })).toBeDisabled();

    // The side step always has an answer (a remembered choice), so NEXT is enabled.
    rerender(<StartMenuScreen {...props} gameMode="bot" difficulty="easy" menuStep="color" wizardCurrentStepNumber={4} />);
    expect(screen.getByRole('button', { name: /PLAY AS RED/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /NEXT/ })).toBeEnabled();
    rerender(<StartMenuScreen {...props} gameMode="bot" menuStep="difficulty" wizardCurrentStepNumber={3} />);
    await userEvent.click(screen.getByRole('button', { name: /BACK/ }));
    expect(props.onPrevStep).toHaveBeenCalledTimes(1);
  });

  it('compact wizard: the last step swaps NEXT for the START button', async () => {
    const props = { ...baseProps(), isCompactLayout: true, menuStep: 'time', gameMode: '1v1', wizardCurrentStepNumber: 3 };
    const { rerender } = render(<StartMenuScreen {...props} />);
    expect(screen.queryByRole('button', { name: /NEXT/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PUSH START BUTTON' })).toBeDisabled();

    rerender(<StartMenuScreen {...props} timeMode="10" />);
    await userEvent.click(screen.getByRole('button', { name: 'PUSH START BUTTON' }));
    expect(props.onStartGame).toHaveBeenCalledTimes(1);
  });

  it('compact wizard: the load step lists saves with only a BACK button', () => {
    const saves = [{ id: 'match_1', date: 'Nov 12', gameMode: '1v1', timeMode: 'none', gameStatus: 'RED TURN' }];
    const { container } = render(
      <StartMenuScreen {...baseProps()} isCompactLayout menuStep="load" savedMatches={saves} />
    );
    expect(screen.getByText('DATE: Nov 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BACK/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /NEXT/ })).not.toBeInTheDocument();
    expect(container.querySelector('.wizard-progress-track')).not.toBeInTheDocument();
  });
});
