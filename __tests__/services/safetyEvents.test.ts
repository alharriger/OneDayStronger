import { supabase } from '@/lib/supabase';
import {
  createSafetyEvent,
  acknowledgeSafetyEvent,
  getPendingSafetyEvent,
  hasPendingSafetyEvent,
} from '@/services/safetyEvents';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

const mockEvent = {
  id: 'event-1',
  user_id: 'user-1',
  session_id: null,
  trigger: 'high_pain_checkin' as const,
  pain_level_reported: 8,
  details: 'Pain at rest is 8/10',
  professional_care_acknowledged: false,
  acknowledged_at: null,
  created_at: '2026-04-12T10:00:00Z',
};

describe('safetyEvents service', () => {
  beforeEach(() => mockedFrom.mockReset());

  describe('createSafetyEvent', () => {
    it('returns the inserted event on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockEvent, error: null }));
      const { event, error } = await createSafetyEvent({
        user_id: 'user-1',
        trigger: 'high_pain_checkin',
        pain_level_reported: 8,
      });
      expect(error).toBeNull();
      expect(event).toEqual(mockEvent);
    });

    it('returns error string on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Insert failed' } }));
      const { event, error } = await createSafetyEvent({
        user_id: 'user-1',
        trigger: 'high_pain_checkin',
      });
      expect(event).toBeNull();
      expect(error).toBe('Insert failed');
    });

    it('queries the safety_events table', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockEvent, error: null }));
      await createSafetyEvent({ user_id: 'user-1', trigger: 'high_pain_checkin' });
      expect(mockedFrom).toHaveBeenCalledWith('safety_events');
    });
  });

  describe('acknowledgeSafetyEvent', () => {
    it('returns null error on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
      const { error } = await acknowledgeSafetyEvent('event-1');
      expect(error).toBeNull();
    });

    it('returns error message on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Update failed' } }));
      const { error } = await acknowledgeSafetyEvent('event-1');
      expect(error).toBe('Update failed');
    });

    it('updates professional_care_acknowledged to true', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await acknowledgeSafetyEvent('event-1');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ professional_care_acknowledged: true })
      );
    });

    it('sets acknowledged_at to an ISO timestamp', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await acknowledgeSafetyEvent('event-1');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledged_at: expect.any(String) })
      );
    });
  });

  describe('getPendingSafetyEvent', () => {
    it('returns the event when an unacknowledged event exists', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockEvent, error: null }));
      const event = await getPendingSafetyEvent('user-1');
      expect(event).toEqual(mockEvent);
    });

    it('returns null when no unacknowledged event exists', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'No rows' } }));
      const event = await getPendingSafetyEvent('user-1');
      expect(event).toBeNull();
    });

    it('filters by professional_care_acknowledged = false', async () => {
      const chain = createChain({ data: mockEvent, error: null });
      mockedFrom.mockReturnValue(chain);
      await getPendingSafetyEvent('user-1');
      expect(chain.eq).toHaveBeenCalledWith('professional_care_acknowledged', false);
    });

    it('filters by user_id', async () => {
      const chain = createChain({ data: mockEvent, error: null });
      mockedFrom.mockReturnValue(chain);
      await getPendingSafetyEvent('user-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('hasPendingSafetyEvent', () => {
    it('returns true when a pending event exists', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockEvent, error: null }));
      expect(await hasPendingSafetyEvent('user-1')).toBe(true);
    });

    it('returns false when no pending event exists', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Not found' } }));
      expect(await hasPendingSafetyEvent('user-1')).toBe(false);
    });
  });
});
