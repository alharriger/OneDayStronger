import { supabase } from '@/lib/supabase';
import { getUnseenEvents, markEventSeen, getEvolutionHistory } from '@/services/evolution';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

const mockProgressionEvent = {
  id: 'event-1',
  user_id: 'user-1',
  plan_id: 'plan-1',
  from_phase_id: 'phase-1',
  to_phase_id: 'phase-2',
  workout_log_id: 'log-1',
  event_type: 'progression' as const,
  rationale: 'Pain and load targets met for 14 days.',
  triggered_by: 'auto' as const,
  seen: false,
  created_at: '2026-04-10T08:00:00Z',
};

describe('evolution service', () => {
  beforeEach(() => mockedFrom.mockReset());

  describe('getUnseenEvents', () => {
    it('returns unseen events on success', async () => {
      const chain = createChain({ data: [mockProgressionEvent], error: null });
      mockedFrom.mockReturnValue(chain);
      const events = await getUnseenEvents('user-1');
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('progression');
    });

    it('returns empty array on Supabase error', async () => {
      const chain = createChain({ data: null, error: { message: 'Query failed' } });
      mockedFrom.mockReturnValue(chain);
      const events = await getUnseenEvents('user-1');
      expect(events).toEqual([]);
    });

    it('queries the plan_evolution_events table', async () => {
      mockedFrom.mockReturnValue(createChain({ data: [], error: null }));
      await getUnseenEvents('user-1');
      expect(mockedFrom).toHaveBeenCalledWith('plan_evolution_events');
    });

    it('filters by user_id', async () => {
      const chain = createChain({ data: [], error: null });
      mockedFrom.mockReturnValue(chain);
      await getUnseenEvents('user-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('filters by seen = false', async () => {
      const chain = createChain({ data: [], error: null });
      mockedFrom.mockReturnValue(chain);
      await getUnseenEvents('user-1');
      expect(chain.eq).toHaveBeenCalledWith('seen', false);
    });
  });

  describe('markEventSeen', () => {
    it('returns null error on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
      const { error } = await markEventSeen('event-1');
      expect(error).toBeNull();
    });

    it('returns error message on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Update failed' } }));
      const { error } = await markEventSeen('event-1');
      expect(error).toBe('Update failed');
    });

    it('calls update with seen: true', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await markEventSeen('event-1');
      expect(chain.update).toHaveBeenCalledWith({ seen: true });
    });

    it('filters update by event id', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await markEventSeen('event-1');
      expect(chain.eq).toHaveBeenCalledWith('id', 'event-1');
    });
  });

  describe('getEvolutionHistory', () => {
    it('returns events on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: [mockProgressionEvent], error: null }));
      const events = await getEvolutionHistory('user-1');
      expect(events).toHaveLength(1);
    });

    it('returns empty array on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Failed' } }));
      const events = await getEvolutionHistory('user-1');
      expect(events).toEqual([]);
    });

    it('passes default limit of 20 to the query', async () => {
      const chain = createChain({ data: [], error: null });
      mockedFrom.mockReturnValue(chain);
      await getEvolutionHistory('user-1');
      expect(chain.limit).toHaveBeenCalledWith(20);
    });

    it('respects a custom limit', async () => {
      const chain = createChain({ data: [], error: null });
      mockedFrom.mockReturnValue(chain);
      await getEvolutionHistory('user-1', 5);
      expect(chain.limit).toHaveBeenCalledWith(5);
    });
  });
});
