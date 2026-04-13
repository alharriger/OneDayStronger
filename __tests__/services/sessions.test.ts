import { supabase } from '@/lib/supabase';
import { getTodaySession, createSession, updateSession, getRecentSessions } from '@/services/sessions';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

describe('sessions service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getTodaySession', () => {
    it('returns null on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'not found' } }));
      const result = await getTodaySession('u');
      expect(result).toBeNull();
    });

    it('returns session on success', async () => {
      const session = { id: 's-1', scheduled_date: '2026-04-12', status: 'scheduled' };
      mockedFrom.mockReturnValue(createChain({ data: session, error: null }));
      const result = await getTodaySession('u');
      expect(result).toEqual(session);
    });
  });

  describe('createSession', () => {
    it('returns session on success', async () => {
      const session = { id: 's-2', user_id: 'u', status: 'scheduled' };
      mockedFrom.mockReturnValue(createChain({ data: session, error: null }));
      const result = await createSession({ user_id: 'u', plan_phase_id: 'p', scheduled_date: '2026-04-12', session_type: 'training', status: 'scheduled' });
      expect(result.session).toEqual(session);
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'constraint' } }));
      const result = await createSession({ user_id: 'u', plan_phase_id: 'p', scheduled_date: '2026-04-12', session_type: 'training', status: 'scheduled' });
      expect(result.session).toBeNull();
      expect(result.error).toBe('constraint');
    });
  });

  describe('updateSession', () => {
    it('returns no error on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
      const result = await updateSession('s-1', { status: 'completed' });
      expect(result.error).toBeNull();
    });

    it('returns error message on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'update failed' } }));
      const result = await updateSession('s-1', { status: 'completed' });
      expect(result.error).toBe('update failed');
    });
  });

  describe('getRecentSessions', () => {
    it('returns empty array on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'err' } }));
      const result = await getRecentSessions('u');
      expect(result).toEqual([]);
    });

    it('returns sessions on success', async () => {
      const sessions = [{ id: 's-1', status: 'completed' }, { id: 's-2', status: 'skipped' }];
      mockedFrom.mockReturnValue(createChain({ data: sessions, error: null }));
      const result = await getRecentSessions('u', 2);
      expect(result).toHaveLength(2);
    });
  });
});
