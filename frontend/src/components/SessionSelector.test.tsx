import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionSelector from './SessionSelector';
import * as api from '../api/client';

// Mock the API module
jest.mock('../api/client');
const mockedApi = api as jest.Mocked<typeof api>;

const mockSeasons = [{ year: 2024 }, { year: 2023 }];
const mockEvents = [
  {
    round_number: 1,
    country: 'Bahrain',
    location: 'Sakhir',
    event_name: 'Bahrain Grand Prix',
    event_date: '2024-03-02',
    event_format: 'conventional',
  },
  {
    round_number: 2,
    country: 'Saudi Arabia',
    location: 'Jeddah',
    event_name: 'Saudi Arabian Grand Prix',
    event_date: '2024-03-09',
    event_format: 'conventional',
  },
];
const mockSessions = [
  { session_key: 'FP1', session_name: 'Practice 1', session_date: '2024-03-01T10:00:00' },
  { session_key: 'Race', session_name: 'Race', session_date: '2024-03-02T15:00:00' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.fetchSeasons.mockResolvedValue(mockSeasons);
  mockedApi.fetchEvents.mockResolvedValue(mockEvents);
  mockedApi.fetchSessions.mockResolvedValue(mockSessions);
});

test('renders three dropdowns with correct labels', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  expect(screen.getByLabelText('Season')).toBeInTheDocument();
  expect(screen.getByLabelText('Grand Prix')).toBeInTheDocument();
  expect(screen.getByLabelText('Session')).toBeInTheDocument();
});

test('loads seasons on mount and populates year dropdown', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(mockedApi.fetchSeasons).toHaveBeenCalledTimes(1);
  });

  const yearSelect = screen.getByTestId('year-select') as HTMLSelectElement;
  // Should have placeholder + 2 year options
  expect(yearSelect.options.length).toBe(3);
  expect(yearSelect.options[1].value).toBe('2024');
  expect(yearSelect.options[2].value).toBe('2023');
});

test('grand prix dropdown is disabled until year is selected', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  const gpSelect = screen.getByTestId('gp-select') as HTMLSelectElement;
  expect(gpSelect).toBeDisabled();
});

test('session dropdown is disabled until grand prix is selected', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  const sessionSelect = screen.getByTestId('session-select') as HTMLSelectElement;
  expect(sessionSelect).toBeDisabled();
});

test('selecting a year fetches events and enables GP dropdown', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } });

  await waitFor(() => {
    expect(mockedApi.fetchEvents).toHaveBeenCalledWith(2024);
  });

  await waitFor(() => {
    const gpSelect = screen.getByTestId('gp-select') as HTMLSelectElement;
    expect(gpSelect).not.toBeDisabled();
    // Placeholder + 2 events
    expect(gpSelect.options.length).toBe(3);
  });
});

test('selecting a GP fetches sessions and enables session dropdown', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } });

  await waitFor(() => {
    expect(screen.getByTestId('gp-select')).not.toBeDisabled();
  });

  fireEvent.change(screen.getByTestId('gp-select'), {
    target: { value: 'Bahrain Grand Prix' },
  });

  await waitFor(() => {
    expect(mockedApi.fetchSessions).toHaveBeenCalledWith(2024, 'Bahrain Grand Prix');
  });

  await waitFor(() => {
    const sessionSelect = screen.getByTestId('session-select') as HTMLSelectElement;
    expect(sessionSelect).not.toBeDisabled();
    expect(sessionSelect.options.length).toBe(3);
  });
});

test('changing year resets grand prix and session selections', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  // Select year
  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } });
  await waitFor(() => expect(screen.getByTestId('gp-select')).not.toBeDisabled());

  // Select GP
  fireEvent.change(screen.getByTestId('gp-select'), {
    target: { value: 'Bahrain Grand Prix' },
  });
  await waitFor(() => expect(screen.getByTestId('session-select')).not.toBeDisabled());

  // Select session
  fireEvent.change(screen.getByTestId('session-select'), { target: { value: 'Race' } });

  // Now change year — downstream should reset
  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2023' } });

  await waitFor(() => {
    const gpSelect = screen.getByTestId('gp-select') as HTMLSelectElement;
    expect(gpSelect.value).toBe('');
  });

  const sessionSelect = screen.getByTestId('session-select') as HTMLSelectElement;
  expect(sessionSelect.value).toBe('');
  expect(sessionSelect).toBeDisabled();
});

test('calls onSessionSelected when all three are chosen', async () => {
  const onSelected = jest.fn();
  render(<SessionSelector onSessionSelected={onSelected} />);

  await waitFor(() => expect(screen.getByTestId('year-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } });
  await waitFor(() => expect(screen.getByTestId('gp-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('gp-select'), {
    target: { value: 'Bahrain Grand Prix' },
  });
  await waitFor(() => expect(screen.getByTestId('session-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('session-select'), { target: { value: 'Race' } });

  await waitFor(() => {
    expect(onSelected).toHaveBeenCalledWith(2024, 'Bahrain Grand Prix', 'Race');
  });
});

test('displays error message when season fetch fails', async () => {
  mockedApi.fetchSeasons.mockRejectedValueOnce(new Error('Network error'));

  render(<SessionSelector onSessionSelected={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load seasons');
  });
});

test('load button is disabled until all three selections are made', async () => {
  render(<SessionSelector onSessionSelected={jest.fn()} onLoadSession={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).not.toBeDisabled();
  });

  const loadBtn = screen.getByTestId('load-session-btn');
  expect(loadBtn).toBeDisabled();
});

test('load button calls onLoadSession when clicked with full selection', async () => {
  const onLoad = jest.fn();
  render(<SessionSelector onSessionSelected={jest.fn()} onLoadSession={onLoad} />);

  await waitFor(() => expect(screen.getByTestId('year-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } });
  await waitFor(() => expect(screen.getByTestId('gp-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('gp-select'), {
    target: { value: 'Bahrain Grand Prix' },
  });
  await waitFor(() => expect(screen.getByTestId('session-select')).not.toBeDisabled());

  fireEvent.change(screen.getByTestId('session-select'), { target: { value: 'Race' } });

  await waitFor(() => {
    expect(screen.getByTestId('load-session-btn')).not.toBeDisabled();
  });

  fireEvent.click(screen.getByTestId('load-session-btn'));

  expect(onLoad).toHaveBeenCalledWith(2024, 'Bahrain Grand Prix', 'Race');
});

test('load button shows loading state when isLoading is true', async () => {
  render(
    <SessionSelector
      onSessionSelected={jest.fn()}
      onLoadSession={jest.fn()}
      isLoading={true}
    />,
  );

  const loadBtn = screen.getByTestId('load-session-btn');
  expect(loadBtn).toBeDisabled();
  expect(loadBtn).toHaveTextContent('Loading...');
});

test('load button shows loaded state when isLoaded is true', async () => {
  render(
    <SessionSelector
      onSessionSelected={jest.fn()}
      onLoadSession={jest.fn()}
      isLoaded={true}
    />,
  );

  const loadBtn = screen.getByTestId('load-session-btn');
  expect(loadBtn).toHaveTextContent('Loaded');
});

test('dropdowns are disabled during loading', async () => {
  render(
    <SessionSelector
      onSessionSelected={jest.fn()}
      onLoadSession={jest.fn()}
      isLoading={true}
    />,
  );

  await waitFor(() => {
    expect(screen.getByTestId('year-select')).toBeDisabled();
  });
});
