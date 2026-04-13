/**
 * Smoke tests for the History screen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HistoryScreen from '../../app/(app)/history';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

jest.mock('@/services/sessions', () => ({
  getRecentSessions: jest.fn().mockResolvedValue([]),
}));

describe('HistoryScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<HistoryScreen />)).not.toThrow();
  });

  it('displays the screen title', () => {
    render(<HistoryScreen />);
    expect(screen.getByText('History')).toBeTruthy();
  });
});

describe('HistoryScreen — with sessions', () => {
  beforeEach(() => {
    const { getRecentSessions } = require('@/services/sessions');
    getRecentSessions.mockResolvedValue([
      { id: 's-1', scheduled_date: '2026-04-10', status: 'completed', skip_reason: null },
      { id: 's-2', scheduled_date: '2026-04-08', status: 'skipped', skip_reason: 'life' },
    ]);
  });

  it('shows session stats after loading', async () => {
    render(<HistoryScreen />);
    await screen.findByText('Sessions done');
    expect(screen.getByText('Sessions done')).toBeTruthy();
    expect(screen.getByText('Consistency')).toBeTruthy();
  });
});

describe('HistoryScreen — empty state', () => {
  beforeEach(() => {
    const { getRecentSessions } = require('@/services/sessions');
    getRecentSessions.mockResolvedValue([]);
  });

  it('shows empty state message', async () => {
    render(<HistoryScreen />);
    await screen.findByText(/no sessions yet/i);
    expect(screen.getByText(/no sessions yet/i)).toBeTruthy();
  });
});
