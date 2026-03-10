import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import * as api from './api/client';

jest.mock('./api/client');
const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  mockedApi.fetchSeasons.mockResolvedValue([{ year: 2024 }]);
  mockedApi.fetchEvents.mockResolvedValue([]);
  mockedApi.fetchSessions.mockResolvedValue([]);
});

test('renders dashboard header', async () => {
  render(<App />);
  expect(screen.getByText(/Race Replay Dashboard/i)).toBeInTheDocument();
  await waitFor(() => expect(mockedApi.fetchSeasons).toHaveBeenCalled());
});

test('renders session selector with three dropdowns', async () => {
  render(<App />);
  expect(screen.getByLabelText('Season')).toBeInTheDocument();
  expect(screen.getByLabelText('Grand Prix')).toBeInTheDocument();
  expect(screen.getByLabelText('Session')).toBeInTheDocument();
  await waitFor(() => expect(mockedApi.fetchSeasons).toHaveBeenCalled());
});
