import { supabase } from '@/lib/supabase';
import { getProfile, updateOnboardingStep, updateProfile } from '@/services/profiles';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

const mockProfile = {
  user_id: 'user-1',
  age: 34,
  gender: 'female',
  rehab_goal: 'return_to_running' as const,
  onboarding_step: 'complete' as const,
  notification_time: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

describe('profiles service', () => {
  beforeEach(() => mockedFrom.mockReset());

  describe('getProfile', () => {
    it('returns profile on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockProfile, error: null }));
      const result = await getProfile('user-1');
      expect(result).toEqual(mockProfile);
    });

    it('returns null on error', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Not found' } }));
      const result = await getProfile('user-1');
      expect(result).toBeNull();
    });

    it('queries the profiles table', async () => {
      mockedFrom.mockReturnValue(createChain({ data: mockProfile, error: null }));
      await getProfile('user-1');
      expect(mockedFrom).toHaveBeenCalledWith('profiles');
    });

    it('filters by user_id', async () => {
      const chain = createChain({ data: mockProfile, error: null });
      mockedFrom.mockReturnValue(chain);
      await getProfile('user-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('updateOnboardingStep', () => {
    it('returns null error on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
      const { error } = await updateOnboardingStep('user-1', 'goal');
      expect(error).toBeNull();
    });

    it('returns error message on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Update failed' } }));
      const { error } = await updateOnboardingStep('user-1', 'goal');
      expect(error).toBe('Update failed');
    });

    it('calls update with the correct onboarding_step', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await updateOnboardingStep('user-1', 'generating');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ onboarding_step: 'generating' })
      );
    });

    it('includes updated_at timestamp in the payload', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await updateOnboardingStep('user-1', 'complete');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      );
    });
  });

  describe('updateProfile', () => {
    it('returns null error on success', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
      const { error } = await updateProfile('user-1', { rehab_goal: 'pain_free_daily' });
      expect(error).toBeNull();
    });

    it('returns error message on failure', async () => {
      mockedFrom.mockReturnValue(createChain({ data: null, error: { message: 'Conflict' } }));
      const { error } = await updateProfile('user-1', { age: 35 });
      expect(error).toBe('Conflict');
    });

    it('merges provided fields with updated_at', async () => {
      const chain = createChain({ data: null, error: null });
      mockedFrom.mockReturnValue(chain);
      await updateProfile('user-1', { rehab_goal: 'return_to_sport' });
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rehab_goal: 'return_to_sport',
          updated_at: expect.any(String),
        })
      );
    });
  });
});
