/**
 * Reset test accounts for manual testing.
 * Wipes all user-generated data for test1@ods.dev and test2@ods.dev
 * while preserving the auth users themselves.
 *
 * Usage:
 *   node scripts/reset-test-accounts.mjs
 *
 * Reads EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

// Parse .env.local manually (no dotenv dependency needed)
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env['EXPO_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAILS = ['test1@ods.dev', 'test2@ods.dev'];

async function run() {
  console.log(`Resetting: ${TEST_EMAILS.join(', ')}`);

  // Get user IDs
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) { console.error('Failed to list users:', usersErr.message); process.exit(1); }

  const testIds = users.users
    .filter(u => TEST_EMAILS.includes(u.email))
    .map(u => u.id);

  if (testIds.length === 0) {
    console.log('No test users found — nothing to reset.');
    return;
  }

  console.log(`Found ${testIds.length} user(s): ${testIds.join(', ')}`);

  // Delete in dependency order
  const steps = [
    { table: 'plan_evolution_events', col: 'user_id' },
    { table: 'llm_call_logs',         col: 'user_id' },
    { table: 'safety_events',         col: 'user_id' },
  ];

  for (const { table, col } of steps) {
    const { error } = await supabase.from(table).delete().in(col, testIds);
    if (error) console.warn(`  ${table}: ${error.message}`);
    else console.log(`  ✓ ${table}`);
  }

  // exercise_logs → workout_logs
  const { data: wlogs } = await supabase.from('workout_logs').select('id').in('user_id', testIds);
  if (wlogs?.length) {
    const wlogIds = wlogs.map(r => r.id);
    await supabase.from('exercise_logs').delete().in('workout_log_id', wlogIds);
    console.log('  ✓ exercise_logs');
  }
  await supabase.from('workout_logs').delete().in('user_id', testIds);
  console.log('  ✓ workout_logs');

  // generated_workout_exercises → generated_workouts → sessions
  const { data: sessions } = await supabase.from('sessions').select('id').in('user_id', testIds);
  if (sessions?.length) {
    const sessionIds = sessions.map(r => r.id);
    const { data: gworkouts } = await supabase.from('generated_workouts').select('id').in('session_id', sessionIds);
    if (gworkouts?.length) {
      await supabase.from('generated_workout_exercises').delete().in('generated_workout_id', gworkouts.map(r => r.id));
      console.log('  ✓ generated_workout_exercises');
    }
    await supabase.from('generated_workouts').delete().in('session_id', sessionIds);
    console.log('  ✓ generated_workouts');
  }
  await supabase.from('check_ins').delete().in('user_id', testIds);
  console.log('  ✓ check_ins');
  await supabase.from('sessions').delete().in('user_id', testIds);
  console.log('  ✓ sessions');

  // phase_exercises → plan_phases → recovery_plans
  const { data: plans } = await supabase.from('recovery_plans').select('id').in('user_id', testIds);
  if (plans?.length) {
    const planIds = plans.map(r => r.id);
    const { data: phases } = await supabase.from('plan_phases').select('id').in('plan_id', planIds);
    if (phases?.length) {
      await supabase.from('phase_exercises').delete().in('phase_id', phases.map(r => r.id));
      console.log('  ✓ phase_exercises');
    }
    await supabase.from('plan_phases').delete().in('plan_id', planIds);
    console.log('  ✓ plan_phases');
  }
  await supabase.from('recovery_plans').delete().in('user_id', testIds);
  console.log('  ✓ recovery_plans');

  // Profile data
  for (const table of ['injury_intake', 'injury_status', 'profiles']) {
    const { error } = await supabase.from(table).delete().in('user_id', testIds);
    if (error) console.warn(`  ${table}: ${error.message}`);
    else console.log(`  ✓ ${table}`);
  }

  // Re-create profile rows so the trigger-created row exists again
  // (trigger only fires on auth.users INSERT, not on profile delete)
  const profileRows = testIds.map(id => ({ user_id: id, onboarding_step: 'intake' }));
  const { error: profileErr } = await supabase.from('profiles').insert(profileRows);
  if (profileErr) console.warn('  profiles (re-create):', profileErr.message);
  else console.log('  ✓ profiles re-created (onboarding_step = intake)');

  console.log('\nReset complete. Test accounts are clean — run onboarding to start fresh.');
}

run().catch(err => { console.error(err); process.exit(1); });
