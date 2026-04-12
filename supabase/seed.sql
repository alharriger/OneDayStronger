-- =============================================================================
-- One Day Stronger — Exercise Seed Data (PHT Library)
-- =============================================================================
-- Proximal Hamstring Tendinopathy (PHT) evidence-based exercise library.
-- Organized by category and progression phase.
--
-- Phases:
--   Phase 1 — Isometric pain management (0-4 weeks)
--   Phase 2 — Isotonic loading / eccentric intro (4-8 weeks)
--   Phase 3 — Heavy slow resistance / progressive loading (8-16 weeks)
--   Phase 4 — Sport-specific / return to activity (16+ weeks)
--
-- Sources: Goom et al. (2016), Purdam et al. (2004), Malliaras et al. (2015)
-- =============================================================================

insert into public.exercises (name, description, instructions, category, video_url) values

-- ─── PHASE 1: ISOMETRICS ────────────────────────────────────────────────────

(
  'Isometric Hip Extension — Standing',
  'Low-load isometric contraction of the hamstring without hip flexion. The primary Phase 1 exercise for managing PHT pain by loading the tendon without compressing it.',
  E'1. Stand behind a wall or sturdy surface. Place a resistance band or towel loop around your ankle, anchored low.\n'
  '2. Straighten your knee and push your heel back against the resistance, squeezing your hamstring.\n'
  '3. Hold for 30–45 seconds. Keep hips level. Do not bend forward at the hip.\n'
  '4. Rest 2–3 minutes between sets.\n'
  '5. Pain during this exercise should be ≤ 3/10. If higher, reduce resistance.',
  'isometric',
  null
),

(
  'Isometric Wall Bridge',
  'Supine isometric bridge with the foot pressed against a wall. Allows controlled hamstring loading in a shortened position, reducing tendon compression.',
  E'1. Lie on your back with knees bent at 90°, feet flat against a wall.\n'
  '2. Press both feet firmly into the wall and drive your hips up until your body forms a straight line from shoulders to knees.\n'
  '3. Hold for 30–45 seconds, squeezing your hamstrings and glutes.\n'
  '4. Lower slowly. Rest 2–3 minutes.\n'
  '5. Single-leg version: perform with the injured leg only when double-leg feels comfortable.',
  'isometric',
  null
),

(
  'Prone Hip Extension Isometric',
  'Prone isometric contraction targeting the proximal hamstring attachment with minimal compressive load on the tendon.',
  E'1. Lie face down. Place a pillow under your hips if needed for comfort.\n'
  '2. With your knee straight, lift one leg off the floor approximately 5–10 cm.\n'
  '3. Hold for 30–45 seconds. Keep your pelvis flat and avoid rotating.\n'
  '4. Lower slowly. Rest 2–3 minutes between sets.\n'
  '5. Increase hold duration before increasing range.',
  'isometric',
  null
),

-- ─── PHASE 2: ECCENTRIC INTRODUCTION ────────────────────────────────────────

(
  'Deadlift — Romanian (Bodyweight)',
  'Bodyweight Romanian deadlift introducing eccentric hamstring loading through hip flexion. A foundational Phase 2 exercise for progressive tendon loading.',
  E'1. Stand with feet hip-width apart. Maintain a neutral spine throughout.\n'
  '2. Hinge at the hips, pushing them back while lowering your hands toward your shins.\n'
  '3. Lower until you feel a strong stretch in your hamstring (typically mid-shin level). Keep knees soft.\n'
  '4. Drive your hips forward to return to standing. Squeeze your glutes at the top.\n'
  '5. Control the descent over 3 seconds. Do not round your lower back.\n'
  '6. Start with both legs. Progress to single-leg when pain-free.',
  'eccentric',
  null
),

(
  'Deadlift — Romanian (Dumbbell)',
  'Loaded Romanian deadlift building on the bodyweight progression. Increases tensile load on the proximal hamstring tendon through controlled hip hinge.',
  E'1. Hold a dumbbell in each hand, arms straight, palms facing your thighs.\n'
  '2. Hinge at the hips and lower the weights along your legs toward the floor.\n'
  '3. Keep your back flat and your knees slightly bent throughout.\n'
  '4. Lower over 3 seconds; rise over 1 second.\n'
  '5. Start light (5–10 kg). Progress load when you can complete all sets at ≤ 2/10 pain for 3 sessions.',
  'eccentric',
  null
),

(
  'Deadlift — Single-Leg Romanian (Bodyweight)',
  'Single-leg Romanian deadlift introducing unilateral eccentric loading. This is a key progression for isolating the injured limb and addressing side-to-side strength asymmetry.',
  E'1. Stand on the affected leg. Hold a wall or chair lightly for balance if needed.\n'
  '2. Hinge forward at the hip while extending the free leg behind you for counterbalance.\n'
  '3. Lower until your torso is approximately parallel to the floor. Keep the standing knee soft.\n'
  '4. Return to upright by driving your hips forward and squeezing your glute.\n'
  '5. Lower over 3 seconds. Aim for a straight line from head to heel of the raised leg.\n'
  '6. Discontinue if pain exceeds 3/10.',
  'eccentric',
  null
),

(
  'Nordic Hamstring Curl — Assisted',
  'Eccentric-focused exercise targeting the hamstring through a long-lever movement. Highly effective for proximal hamstring strength but must be introduced conservatively in PHT.',
  E'1. Kneel on a padded surface with your ankles anchored under a bar or held by a partner.\n'
  '2. Keeping your hips and torso in a straight line, slowly lower yourself toward the floor by allowing your knees to extend.\n'
  '3. Use your hands to catch yourself at the bottom. Push back up and return to start.\n'
  '4. Lower over 4–6 seconds. Minimize hip flexion throughout — this is the key for PHT.\n'
  '5. Begin with 2–3 reps only. Increase by 1–2 reps per session as tolerated.\n'
  '6. Do NOT use if pain > 3/10 at the proximal hamstring site.',
  'eccentric',
  null
),

-- ─── PHASE 3: HEAVY SLOW RESISTANCE ─────────────────────────────────────────

(
  'Deadlift — Conventional (Barbell)',
  'Heavy bilateral hip hinge with barbell. The primary strength exercise in Phase 3. Builds tensile capacity of the proximal hamstring tendon under progressive load.',
  E'1. Stand with feet hip-width apart, bar over mid-foot. Grip just outside your legs.\n'
  '2. Hinge at the hips and bend knees until shins touch the bar. Set a neutral spine.\n'
  '3. Take a deep breath, brace your core, and drive your feet into the floor as you extend your hips and knees simultaneously.\n'
  '4. Keep the bar close to your body throughout. Lock out at the top — hips fully extended, shoulders back.\n'
  '5. Lower with control (2–3 seconds). Avoid rounding the lower back.\n'
  '6. Load progression: add 2.5–5 kg when all sets are completed at ≤ 2/10 pain across 2–3 sessions.',
  'strength',
  null
),

(
  'Deadlift — Single-Leg Romanian (Dumbbell)',
  'Loaded unilateral RDL building on the bodyweight single-leg progression. Key exercise for restoring limb symmetry in Phase 3.',
  E'1. Hold a dumbbell in the hand opposite to the standing leg (or ipsilateral for advanced).\n'
  '2. Hinge forward at the hip, keeping the standing knee soft and the trailing leg in line with your torso.\n'
  '3. Lower until the dumbbell reaches mid-shin. Keep your back flat.\n'
  '4. Lower over 3 seconds; return over 1 second.\n'
  '5. Progress load when you can complete all sets without pain compensation (hip drop, trunk rotation).',
  'strength',
  null
),

(
  'Hip Thrust — Barbell',
  'Barbell hip thrust targeting the gluteus maximus and proximal hamstrings in a shortened-range position. Builds posterior chain power with low compressive load on the tendon.',
  E'1. Sit on the floor with your upper back against a bench. Place a barbell across your hip crease with a pad for comfort.\n'
  '2. Plant your feet firmly, hip-width apart, knees bent at ~90°.\n'
  '3. Drive your hips up until your body forms a straight line from knees to shoulders. Squeeze glutes hard at the top.\n'
  '4. Lower under control (2 seconds). Do not let your lower back hyperextend at the top.\n'
  '5. Keep the movement smooth — avoid bouncing at the bottom.',
  'strength',
  null
),

(
  'Leg Curl — Seated Machine',
  'Seated leg curl isolating the hamstrings through knee flexion. Important for building strength through range while managing compressive load at the proximal attachment.',
  E'1. Adjust the seat so your knees align with the pivot point. The pad should rest on the back of your ankles.\n'
  '2. Keep your hips flat against the seat throughout — do not allow your pelvis to tilt forward.\n'
  '3. Curl the pad toward your glutes with control (1–2 seconds), then lower slowly (3 seconds).\n'
  '4. Start with a light weight and moderate range. Increase range of motion gradually over sessions.\n'
  '5. Avoid if this causes sharp pain at the proximal hamstring site.',
  'strength',
  null
),

(
  'Step-Up — Weighted',
  'Unilateral lower body strength exercise building quad and glute strength to support hamstring function. Useful for addressing limb symmetry deficits.',
  E'1. Stand in front of a box or step at knee height or slightly below. Hold dumbbells at your sides.\n'
  '2. Place the working foot flat on the box. Drive through the heel to step up, bringing the trailing leg to a standing position on top.\n'
  '3. Step back down with control. The working leg remains on the box throughout the set.\n'
  '4. Do not push off with the trailing foot — all drive from the working leg.\n'
  '5. Progress box height and load as strength improves.',
  'strength',
  null
),

-- ─── PHASE 4: RETURN TO ACTIVITY / SPORT-SPECIFIC ───────────────────────────

(
  'Running Progression — Walk/Run Intervals',
  'Structured walk-run protocol for returning to running after PHT. Manages cumulative tendon load by alternating high-demand intervals with recovery.',
  E'1. Begin on a flat, firm surface (track or path). Avoid hills initially.\n'
  '2. Week 1: Walk 5 min, then alternate 1 min run / 2 min walk × 6 rounds. Total ~25 min.\n'
  '3. Increase run interval by 30 sec every 2 sessions if pain stays ≤ 2/10 during AND 24 hours after.\n'
  '4. Run at a conversational pace only. No sprinting until continuous 20+ min runs are pain-free.\n'
  '5. If pain > 3/10 during a session: stop running, walk home. Reduce next session volume by 25%.\n'
  '6. Rest at least one full day between running sessions.',
  'cardio',
  null
),

(
  'Hamstring Deadlift — Heavy Single-Leg (Barbell)',
  'Advanced single-leg deadlift with barbell. Targets maximal unilateral hamstring and gluteal strength for full return-to-sport loading capacity.',
  E'1. Hold a barbell in both hands in front of your thighs. Stand on the affected leg.\n'
  '2. Hinge at the hip, lowering the bar along your leg while extending the free leg behind.\n'
  '3. Lower under strict control (3–4 seconds). The barbell should travel close to the standing leg.\n'
  '4. Drive through the standing heel to return to upright. Lock out completely.\n'
  '5. This is an advanced exercise — only introduce when single-leg dumbbell RDL is pain-free at moderate load for 4+ sessions.',
  'strength',
  null
),

(
  'Sprint Progression — Acceleration',
  'Graduated acceleration drill reintroducing high hamstring loads required for running at speed. Final stage before return to sport.',
  E'1. Begin on a track or grass. Mark a 30m zone.\n'
  '2. Week 1: Run at 60% effort over 20m, decelerate over remaining 10m. 6–8 reps. Full rest between reps.\n'
  '3. Week 2: Increase to 70% effort. Maintain the same distance and rep count.\n'
  '4. Increase intensity by 5–10% every 2 sessions if pain-free during and 24 hours after.\n'
  '5. Do not progress to max-effort sprinting until 90% effort is pain-free for 3 sessions.\n'
  '6. Always warm up with 10 min easy running before sprint work.',
  'cardio',
  null
),

-- ─── MOBILITY & ADJUNCTS ─────────────────────────────────────────────────────

(
  'Hip Flexor Stretch — Kneeling',
  'Kneeling hip flexor stretch to address anterior hip tightness, which is commonly associated with altered running mechanics in PHT.',
  E'1. Kneel on the affected side knee on a padded surface, front foot flat on the floor.\n'
  '2. Shift your hips forward until you feel a stretch at the front of the kneeling hip.\n'
  '3. Keep your torso upright and avoid arching your lower back.\n'
  '4. Hold for 30–60 seconds. Breathe normally throughout.\n'
  '5. Add a gentle side reach (reach the same-side arm overhead) to deepen the stretch into the lateral hip flexors.',
  'mobility',
  null
),

(
  'Calf Raise — Standing (Double-Leg)',
  'Standing calf raise for lower leg conditioning and tendon loading. Supports return to running by building load tolerance through the Achilles and soleus.',
  E'1. Stand with feet hip-width apart, toes slightly out. Hold a wall lightly for balance.\n'
  '2. Rise onto the balls of your feet as high as possible, squeezing your calves at the top.\n'
  '3. Lower slowly over 3 seconds. Do not bounce at the bottom.\n'
  '4. Progress to single-leg when double-leg is easy across all sets.',
  'strength',
  null
),

(
  'Glute Bridge — Double-Leg',
  'Supine hip extension activating the glutes and hamstrings through a shortened range. Low-load posterior chain activation suitable across all phases.',
  E'1. Lie on your back with knees bent at 90°, feet flat on the floor hip-width apart.\n'
  '2. Press your feet into the floor and drive your hips up until your body is in a straight line from knees to shoulders.\n'
  '3. Squeeze your glutes firmly at the top. Hold 1–2 seconds.\n'
  '4. Lower slowly (2–3 seconds). Do not let your lower back arch.\n'
  '5. Progression: add a 3-second pause at the top; add resistance band above knees; progress to single-leg.',
  'strength',
  null
),

(
  'Glute Bridge — Single-Leg',
  'Unilateral glute bridge building posterior chain strength and stability. Bridges the gap between double-leg bridge and more demanding hip hinge exercises.',
  E'1. Lie on your back. Extend one leg straight, foot flexed. Bend the working leg to 90°.\n'
  '2. Drive through the heel of the working leg to lift your hips until your body is straight from knee to shoulder.\n'
  '3. Keep your pelvis level — resist the pull of the unsupported side.\n'
  '4. Hold 1–2 seconds at the top. Lower slowly (3 seconds).\n'
  '5. Increase range of motion and add holds before progressing to loaded variations.',
  'strength',
  null
);
