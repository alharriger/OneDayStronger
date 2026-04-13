import { supabase } from '@/lib/supabase';
import { invokeRevisePlan } from '@/services/revision';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockedInvoke = supabase.functions.invoke as jest.Mock;

describe('invokeRevisePlan', () => {
  const validStatus = {
    pain_level_baseline: 5,
    current_symptoms: 'Increased pain at sit bone',
    last_flare_date: '2026-04-10',
  };

  beforeEach(() => mockedInvoke.mockReset());

  it('returns planId and summary on success', async () => {
    mockedInvoke.mockResolvedValue({
      data: { planId: 'plan-new-1', summary: 'Revised 3-phase plan.' },
      error: null,
    });

    const result = await invokeRevisePlan(validStatus);
    expect(result.error).toBeNull();
    expect(result.planId).toBe('plan-new-1');
    expect(result.summary).toBe('Revised 3-phase plan.');
  });

  it('invokes the revise-plan edge function with injuryStatus in body', async () => {
    mockedInvoke.mockResolvedValue({ data: { planId: 'p1', summary: 's' }, error: null });
    await invokeRevisePlan(validStatus);
    expect(mockedInvoke).toHaveBeenCalledWith('revise-plan', { body: { injuryStatus: validStatus } });
  });

  it('returns error message when edge function returns an error object', async () => {
    mockedInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function failed' },
    });

    const result = await invokeRevisePlan(validStatus);
    expect(result.error).toBe('Edge function failed');
    expect(result.planId).toBeNull();
  });

  it('returns error message from data.error when invocation succeeds but plan fails', async () => {
    mockedInvoke.mockResolvedValue({
      data: { error: 'No active plan to revise.' },
      error: null,
    });

    const result = await invokeRevisePlan(validStatus);
    expect(result.error).toBe('No active plan to revise.');
    expect(result.planId).toBeNull();
  });

  it('returns null planId and null summary on error', async () => {
    mockedInvoke.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    const result = await invokeRevisePlan(validStatus);
    expect(result.planId).toBeNull();
    expect(result.summary).toBeNull();
  });
});
