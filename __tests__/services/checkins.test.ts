import { supabase } from '@/lib/supabase';
import { submitCheckIn, getRecentCheckIns, getTodayCheckIn } from '@/services/checkins';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

describe('checkins service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('submitCheckIn', () => {
    it('returns checkIn on success', async () => {
      const checkIn = { id: 'ci-1', user_id: 'u', pain_level: 3, soreness_level: 2 };
      mockedFrom.mockReturnValue(createChain({ data: checkIn, error: null }));
      const result = await submitCheckIn({ user_id: 'u', pain_level: 3, soreness_level: 2 });
      expect(result.checkIn).toEqual(checkIn);
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'DB error' } }));
      const result = await submitCheckIn({ user_id: 'u', pain_level: 3, soreness_level: 2 });
      expect(result.checkIn).toBeNull();
      expect(result.error).toBe('DB error');
    });
  });

  describe('getRecentCheckIns', () => {
    it('returns empty array on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'err' } }));
      const result = await getRecentCheckIns('u');
      expect(result).toEqual([]);
    });

    it('returns check-in list on success', async () => {
      const checkIns = [{ id: 'ci-1', pain_level: 2 }, { id: 'ci-2', pain_level: 4 }];
      mockedFrom.mockReturnValue(createChain({ data: checkIns, error: null }));
      const result = await getRecentCheckIns('u', 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('getTodayCheckIn', () => {
    it('returns null on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'err' } }));
      const result = await getTodayCheckIn('u');
      expect(result).toBeNull();
    });

    it('returns check-in when found', async () => {
      const ci = { id: 'ci-today', pain_level: 1 };
      mockedFrom.mockReturnValue(createChain({ data: ci, error: null }));
      const result = await getTodayCheckIn('u');
      expect(result).toEqual(ci);
    });
  });
});
