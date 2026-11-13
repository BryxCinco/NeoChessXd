import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveSlotCard, SavedMatchesList } from './SaveSlotCard';

const botMatch = {
  id: 'match_1',
  date: 'Nov 12, 10:00:00 AM',
  gameMode: 'bot',
  difficulty: 'hard',
  timeMode: '5',
  gameStatus: 'BLUE TURN',
};
const localMatch = { id: 'match_2', date: 'Nov 11, 09:30:00 PM', gameMode: '1v1', timeMode: 'none', gameStatus: 'RED TURN' };

describe('SaveSlotCard', () => {
  it('shows the save info: mode, difficulty, time limit, date and status', () => {
    render(<SaveSlotCard match={botMatch} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('CPU (HARD)')).toBeInTheDocument();
    expect(screen.getByText('TIME: 5M')).toBeInTheDocument();
    expect(screen.getByText('DATE: Nov 12, 10:00:00 AM')).toBeInTheDocument();
    expect(screen.getByText('BLUE TURN')).toBeInTheDocument();
  });

  it('labels a local match with no time limit as 1VS1 / INF', () => {
    render(<SaveSlotCard match={localMatch} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('1VS1')).toBeInTheDocument();
    expect(screen.getByText('TIME: INF')).toBeInTheDocument();
  });

  it('does not crash on a bot save that lost its difficulty', () => {
    render(<SaveSlotCard match={{ ...botMatch, difficulty: undefined }} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('CPU ()')).toBeInTheDocument();
  });

  it('gives LOAD and CLR descriptive aria-labels that name the save', () => {
    render(<SaveSlotCard match={botMatch} onResume={() => {}} onDelete={() => {}} />);
    const load = screen.getByRole('button', { name: 'Load saved match from Nov 12, 10:00:00 AM' });
    const clear = screen.getByRole('button', { name: 'Delete saved match from Nov 12, 10:00:00 AM' });
    expect(load).toHaveTextContent('LOAD SLOT');
    expect(clear).toHaveTextContent('CLR');
    expect(load).toHaveAttribute('type', 'button');
    expect(clear).toHaveAttribute('type', 'button');
  });

  it('LOAD SLOT (and the card itself) asks to resume this match', async () => {
    const onResume = vi.fn();
    render(<SaveSlotCard match={botMatch} onResume={onResume} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /^Load saved match/ }));
    expect(onResume).toHaveBeenLastCalledWith(botMatch);

    await userEvent.click(screen.getByText('BLUE TURN'));
    expect(onResume).toHaveBeenCalledTimes(2);
  });

  it('LOAD SLOT works from the keyboard', async () => {
    const onResume = vi.fn();
    render(<SaveSlotCard match={botMatch} onResume={onResume} onDelete={() => {}} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /^Load saved match/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onResume).toHaveBeenCalledWith(botMatch);
  });

  it('CLR asks to delete this slot (id + the click event) without also loading it', async () => {
    const onResume = vi.fn();
    // Like the real handler, stop the click from reaching the card.
    const onDelete = vi.fn((_id, e) => e.stopPropagation());
    render(<SaveSlotCard match={botMatch} onResume={onResume} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /^Delete saved match/ }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0]).toBe('match_1');
    expect(onDelete.mock.calls[0][1]).toHaveProperty('stopPropagation');
    expect(onResume).not.toHaveBeenCalled();
  });
});

describe('SavedMatchesList', () => {
  it('shows a banner when there are no saves', () => {
    render(<SavedMatchesList savedMatches={[]} onResume={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('-- NO CURRENT DATA FOUND --')).toBeInTheDocument();
  });

  it('renders one card per save, in the given order', () => {
    render(<SavedMatchesList savedMatches={[botMatch, localMatch]} onResume={() => {}} onDelete={() => {}} />);
    const loadButtons = screen.getAllByRole('button', { name: /^Load saved match/ });
    expect(loadButtons).toHaveLength(2);
    expect(loadButtons[0]).toHaveAccessibleName('Load saved match from Nov 12, 10:00:00 AM');
    expect(loadButtons[1]).toHaveAccessibleName('Load saved match from Nov 11, 09:30:00 PM');
  });
});
