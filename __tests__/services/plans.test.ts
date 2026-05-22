import { supabase } from '@/lib/supabase';
import { jumpToPhase } from '@/services/plans';
import { createChain } from '../helpers/supabaseMock';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

describe('jumpToPhase', () => {
  beforeEach(() => mockedFrom.mockReset());

  const baseParams = {
    planId: 'plan-1',
    userId: 'user-1',
    targetPhaseId: 'phase-3',
    targetPhaseNumber: 3,
    fromPhaseId: 'phase-1',
    fromPhaseNumber: 1,
  };

  // ─── Guards ───────────────────────────────────────────────────────────────

  it('returns error when target phase number equals current phase number', async () => {
    const result = await jumpToPhase({
      ...baseParams,
      targetPhaseNumber: 1,
      fromPhaseNumber: 1,
    });
    expect(result.error).toBe('You are already on that phase.');
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('allows backward jump (regression) without error', async () => {
    mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
    const result = await jumpToPhase({
      ...baseParams,
      targetPhaseNumber: 1,
      fromPhaseNumber: 3,
    });
    expect(result.error).toBeNull();
  });

  it('allows jump when there is no current active phase (fromPhaseNumber is null)', async () => {
    mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
    const result = await jumpToPhase({ ...baseParams, fromPhaseId: null, fromPhaseNumber: null });
    expect(result.error).toBeNull();
  });

  it('returns null error on golden path forward jump', async () => {
    mockedFrom.mockReturnValue(createChain({ data: null, error: null }));
    const result = await jumpToPhase(baseParams);
    expect(result.error).toBeNull();
  });

  // ─── DB call order ────────────────────────────────────────────────────────

  it('marks prior phases completed — calls plan_phases table first', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(mockedFrom).toHaveBeenNthCalledWith(1, 'plan_phases');
  });

  it('filters prior-phase update by plan_id', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(chain.eq).toHaveBeenCalledWith('plan_id', 'plan-1');
  });

  it('uses lt to select phases before target', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(chain.lt).toHaveBeenCalledWith('phase_number', 3);
  });

  it('sets target phase to active status', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('marks phases after target as upcoming', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'upcoming' })
    );
    expect(chain.gt).toHaveBeenCalledWith('phase_number', 3);
  });

  it('inserts a plan_evolution_events row with user_initiated trigger (forward)', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase(baseParams);
    expect(mockedFrom).toHaveBeenCalledWith('plan_evolution_events');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'progression',
        triggered_by: 'user_initiated',
        user_id: 'user-1',
        plan_id: 'plan-1',
        from_phase_id: 'phase-1',
        to_phase_id: 'phase-3',
      })
    );
  });

  it('logs event_type regression for a backward jump', async () => {
    const chain = createChain({ data: null, error: null });
    mockedFrom.mockReturnValue(chain);
    await jumpToPhase({ ...baseParams, targetPhaseNumber: 1, fromPhaseNumber: 3 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'regression' })
    );
  });

  it('updates today session plan_phase_id when session exists', async () => {
    const sessionChain = createChain({ data: { id: 'session-today' }, error: null });
    const defaultChain = createChain({ data: null, error: null });
    mockedFrom
      .mockReturnValueOnce(defaultChain) // prior phases
      .mockReturnValueOnce(defaultChain) // target phase
      .mockReturnValueOnce(defaultChain) // upcoming phases
      .mockReturnValueOnce(defaultChain) // event insert
      .mockReturnValueOnce(sessionChain) // today session query
      .mockReturnValueOnce(defaultChain) // session update
      .mockReturnValueOnce(defaultChain) // workout delete
      .mockReturnValueOnce(defaultChain); // check-in delete
    await jumpToPhase(baseParams);
    expect(defaultChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_phase_id: 'phase-3' })
    );
  });

  // ─── Error propagation ────────────────────────────────────────────────────

  it('returns error when prior-phase update fails', async () => {
    mockedFrom.mockReturnValueOnce(
      createChain({ data: null, error: { message: 'DB error on prior phases' } })
    );
    const result = await jumpToPhase(baseParams);
    expect(result.error).toBe('DB error on prior phases');
  });

  it('returns error when target phase update fails', async () => {
    mockedFrom
      .mockReturnValueOnce(createChain({ data: null, error: null })) // prior phases OK
      .mockReturnValueOnce(
        createChain({ data: null, error: { message: 'DB error on target phase' } })
      );
    const result = await jumpToPhase(baseParams);
    expect(result.error).toBe('DB error on target phase');
  });

  it('returns error when upcoming-phase update fails', async () => {
    mockedFrom
      .mockReturnValueOnce(createChain({ data: null, error: null })) // prior phases OK
      .mockReturnValueOnce(createChain({ data: null, error: null })) // target phase OK
      .mockReturnValueOnce(
        createChain({ data: null, error: { message: 'DB error on upcoming phases' } })
      );
    const result = await jumpToPhase(baseParams);
    expect(result.error).toBe('DB error on upcoming phases');
  });

  it('returns error when evolution event insert fails', async () => {
    mockedFrom
      .mockReturnValueOnce(createChain({ data: null, error: null })) // prior phases OK
      .mockReturnValueOnce(createChain({ data: null, error: null })) // target phase OK
      .mockReturnValueOnce(createChain({ data: null, error: null })) // upcoming OK
      .mockReturnValueOnce(
        createChain({ data: null, error: { message: 'DB error on event insert' } })
      );
    const result = await jumpToPhase(baseParams);
    expect(result.error).toBe('DB error on event insert');
  });

  it('does not call evolution event insert if prior-phase update fails', async () => {
    mockedFrom.mockReturnValueOnce(
      createChain({ data: null, error: { message: 'fail' } })
    );
    await jumpToPhase(baseParams);
    expect(mockedFrom).not.toHaveBeenCalledWith('plan_evolution_events');
  });
});
