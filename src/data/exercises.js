export const BASE_EXERCISE_TYPES = {
  d1_incline: 'compound',
  d1_midchest: 'isolation',
  d1_lowerchest: 'isolation',
  d1_shoulder: 'compound',
  d1_sidedelt: 'isolation',
  d1_bicepmid: 'isolation',
  d1_bicepstretch: 'isolation',
  d1_brachialis: 'isolation',
  d2_smithSquat: 'compound',
  d2_legext: 'isolation',
  d2_quadpress: 'compound',
  d2_hamstring: 'isolation',
  d2_adductor: 'isolation',
  d2_abductor: 'isolation',
  d2_calf: 'isolation',
  d2_lowerabs: 'isolation',
  d2_upperabs: 'isolation',
  d3_backthickness: 'compound',
  d3_latwidth: 'compound',
  d3_unilat: 'isolation',
  d3_reardelt: 'isolation',
  d3_tricepskull: 'isolation',
  d3_triceppushdown: 'isolation',
  d3_tricepoverhead: 'isolation',
  d3_trap: 'isolation'
};

export const BASE_MUSCLE_GROUP = {
  d1_incline: 'chest',
  d1_midchest: 'chest',
  d1_lowerchest: 'chest',
  d3_backthickness: 'back',
  d3_latwidth: 'back',
  d3_unilat: 'back',
  d2_smithSquat: 'legs',
  d2_legext: 'legs',
  d2_quadpress: 'legs',
  d2_hamstring: 'legs',
  d2_adductor: 'legs',
  d2_abductor: 'legs',
  d2_calf: 'legs',
  d1_shoulder: 'shoulders',
  d1_sidedelt: 'shoulders',
  d3_reardelt: 'shoulders',
  d3_trap: 'shoulders',
  d1_bicepmid: 'arms',
  d1_bicepstretch: 'arms',
  d1_brachialis: 'arms',
  d3_tricepskull: 'arms',
  d3_triceppushdown: 'arms',
  d3_tricepoverhead: 'arms'
};
const V = (value, label, setup, cue, sets) => ({
  value,
  label,
  setup: setup ? '⚙️ Setup: ' + setup : '',
  cue: cue ? '💡 ' + cue : '',
  defaultSets: sets.map(s => ({ weight: s[0], reps: s[1], rir: s[2], tag: s[3] || 'Working' }))
});
const E = (category, prefix, title, target, scheme, rest, sets, variations) => {
  const exerciseType = BASE_EXERCISE_TYPES[category] || 'isolation';
  return {
    category,
    prefix,
    title,
    target,
    scheme,
    rest: exerciseType === 'compound' ? 150 : 75,
    defaultRows: sets,
    variations,
    exerciseType
  };
};

export const WORKOUT_BASE = {
  1: {
    title: '⚡ Chest • Shoulders • Biceps',
    badge: 'Day 1 Focus',
    badgeClass: 'badge-d1',
    sub: 'Push Hypertrophy & Arm Specialization',
    sections: [
      {
        title: 'Chest Focus',
        tag: 'd1_tag_chest',
        color: 'red',
        exercises: [
          E(
            'd1_incline',
            'd1_inc',
            'Incline Upper Chest Press',
            'Upper Pecs (Clavicular Head)',
            '2–3 × 6–10 | Rest 2–3m | RIR 1–2',
            150,
            3,
            [
              V(
                'iso_smith',
                'Iso-Smith Press',
                'Bench 15°–30°, elbows tucked 45°–60°, 1s pause at bottom',
                'Bench 15°–30°. Elbows tucked ~45°–60°. 1s pause at bottom.',
                [
                  [20, 10, 2, 'Working'],
                  [20, 8, 1, 'Working'],
                  [20, 8, 1, 'Working']
                ]
              ),
              V(
                'smith_bar',
                'Incline Smith Bar Press',
                'Bench 15°–30°, Smith at 3rd hole',
                'Bench 15°–30°. Elbows tucked ~45°–60°. 1s pause at bottom.',
                [
                  [55, 8, 2, 'Working'],
                  [55, 6, 1, 'Working'],
                  [50, 6, 1, 'Working']
                ]
              ),
              V(
                'hammer',
                'Incline Hammer Press',
                'Hole 4/5 + mat behind back',
                'Bench 15°–30°. Elbows tucked ~45°–60°. 1s pause at bottom.',
                [
                  [40, 10, 2, 'Working'],
                  [40, 8, 1, 'Working'],
                  [40, 7, 1, 'Working']
                ]
              ),
              V(
                'db_incline',
                'Incline DB Press',
                'Bench 15°–30°',
                'Bench 15°–30°. Elbows tucked ~45°–60°. 1s pause at bottom.',
                [
                  [25, 10, 2, 'Working'],
                  [25, 8, 1, 'Working'],
                  [22.5, 8, 1, 'Working']
                ]
              )
            ]
          ),
          E(
            'd1_midchest',
            'd1_mid',
            'Mid Chest Isolation',
            'Mid Pecs (Sternal Head)',
            '2 × 10–12 | Rest 60–90s | RIR 1–2',
            75,
            2,
            [
              V('pec_dec', 'Pec Dec Fly', 'Up:4 / Seat:2', 'Hold 1s peak contraction. Drive inner elbows together.', [
                [45, 11, 2, 'Working'],
                [45, 10, 1, 'Working']
              ]),
              V(
                'cable_fly',
                'Cable Fly',
                'Cable at chest height, slight forward lean',
                'Hold 1s peak contraction. Drive inner elbows together.',
                [
                  [15, 12, 2, 'Working'],
                  [15, 11, 1, 'Working']
                ]
              )
            ]
          ),
          E(
            'd1_lowerchest',
            'd1_low',
            'Lower Chest Isolation',
            'Lower Pecs (Abdominal Head)',
            '2 × 12–15 + dropset | Rest 60–90s',
            75,
            2,
            [
              V(
                'high_low_cable',
                'High-to-Low Cable Fly',
                'Cable high, bench ~75°',
                'Pulleys above head. Sweep down to hips. 🔥 Dropset on Set 2.',
                [
                  [12.5, 12, 2, 'Working'],
                  [7.5, 12, 0, 'Drop Set']
                ]
              ),
              V(
                'decline_cable',
                'Decline Cable Fly',
                'Cable high, decline angle',
                'Squeeze low line. 🔥 Dropset on Set 2.',
                [
                  [10, 12, 2, 'Working'],
                  [7.5, 12, 0, 'Drop Set']
                ]
              )
            ]
          )
        ]
      },
      {
        title: 'Shoulders',
        tag: 'd1_tag_shoulders',
        color: 'blue',
        exercises: [
          E(
            'd1_shoulder',
            'd1_sh',
            'Overhead Shoulder Press',
            'Front & Medial Delts',
            '2 × 8–12 | Rest 90–120s | RIR 1–2',
            105,
            2,
            [
              V('iso_mach', 'Iso-Machine', 'Hole 4', 'Elbows forward. Lower to chin/upper chest.', [
                [30, 10, 2, 'Working'],
                [30, 8, 1, 'Working']
              ]),
              V('iso_smith', 'Iso-Smith', 'Hole 6', 'Elbows forward. Lower to chin/upper chest.', [
                [15, 10, 2, 'Working'],
                [15, 10, 1, 'Working']
              ]),
              V('smith_bar', 'Smith Bar', 'Hole 6', 'Elbows forward. Lower to chin/upper chest.', [
                [35, 8, 2, 'Working'],
                [30, 10, 1, 'Working']
              ]),
              V('db_press', 'Seated DB Press', '75° bench', 'Elbows forward. Lower to chin/upper chest.', [
                [25, 10, 2, 'Working'],
                [25, 8, 1, 'Working']
              ])
            ]
          ),
          E(
            'd1_sidedelt',
            'd1_sd',
            'Side Delt Isolation',
            'Medial Deltoids',
            '3 × 12–20 + dropset | Rest 60s | RIR 0–2',
            60,
            3,
            [
              V(
                'mach',
                'Machine Lateral Raise',
                'Hole 6',
                'Pulley at wrist height. Raise in scapular plane. 🔥 Dropset on Set 3.',
                [
                  [15, 15, 2, 'Working'],
                  [15, 15, 1, 'Working'],
                  [10, 12, 0, 'Drop Set']
                ]
              ),
              V(
                'cable',
                'Cable Lateral Raise',
                'Single pulley at wrist height',
                'Pulley at wrist height. Raise in scapular plane. 🔥 Dropset on Set 3.',
                [
                  [5, 15, 2, 'Working'],
                  [5, 15, 1, 'Working'],
                  [2.5, 12, 0, 'Drop Set']
                ]
              ),
              V(
                'db',
                'DB Lateral Raise',
                'Standing, 30° scapular plane',
                'Pulley at wrist height. Raise in scapular plane. 🔥 Dropset on Set 3.',
                [
                  [8, 15, 2, 'Working'],
                  [8, 15, 1, 'Working'],
                  [5, 12, 0, 'Drop Set']
                ]
              )
            ]
          )
        ]
      },
      {
        title: 'Biceps',
        tag: 'd1_tag_arms',
        color: 'green',
        exercises: [
          E(
            'd1_bicepmid',
            'd1_bm',
            'Biceps Mid-Range / Peak',
            'Biceps Short Head',
            '2 × 8–12 | Rest 60–90s | RIR 1–2',
            75,
            2,
            [
              V('cable_straight', 'Cable Straight Bar', 'Cable low pulley', 'Wrists straight; no momentum.', [
                [35, 10, 2, 'Working'],
                [35, 8, 1, 'Working']
              ]),
              V(
                'preacher',
                'Machine / Preacher Curl',
                'Upper arms flat on pad',
                'Upper arms flat on pad / elbows pinned. Wrists straight; no momentum.',
                [
                  [30, 10, 2, 'Working'],
                  [30, 8, 1, 'Working']
                ]
              ),
              V('ez_bar', 'EZ-Bar Curl', 'Standing strict form', 'Wrists straight; no momentum.', [
                [25, 10, 2, 'Working'],
                [25, 8, 1, 'Working']
              ])
            ]
          ),
          E(
            'd1_bicepstretch',
            'd1_bs',
            'Biceps Lengthened Stretch',
            'Biceps Long Head',
            '2–3 × 10–12 | Rest 60–90s | RIR 1–2',
            75,
            3,
            [
              V(
                'bayesian',
                'Bayesian Cable Curl',
                'Hip height, face away',
                'Pulley at hip height, face away. Keep elbows locked behind torso.',
                [
                  [15, 10, 2, 'Working'],
                  [15, 10, 1, 'Working'],
                  [12.5, 10, 1, 'Working']
                ]
              ),
              V('incline_db', 'Incline DB Curl', 'Bench 45°–60°', 'Keep elbows locked behind torso.', [
                [12.5, 10, 2, 'Working'],
                [12.5, 8, 1, 'Working'],
                [10, 10, 1, 'Working']
              ])
            ]
          ),
          E(
            'd1_brachialis',
            'd1_br',
            'Brachialis & Width',
            'Brachialis / Forearm Width',
            '2 × 8–12 + dropset | Rest 60–90s | RIR 1–2',
            75,
            2,
            [
              V(
                'cable_rope',
                'Cable Rope Hammer Curl',
                'Floor dual cable rope',
                'Neutral grip. Flare rope slightly at peak; strict 2–3s negative.',
                [
                  [25, 10, 2, 'Working'],
                  [25, 8, 0, 'Drop Set']
                ]
              ),
              V(
                'db_hammer',
                'DB Hammer Curl',
                'Standing neutral hammer',
                'Neutral grip. Strict 2–3s controlled negative.',
                [
                  [12.5, 10, 2, 'Working'],
                  [12.5, 8, 0, 'Drop Set']
                ]
              )
            ]
          )
        ]
      }
    ]
  },
  2: {
    title: '⚡ Legs • Calves • Core',
    badge: 'Day 2 Focus',
    badgeClass: 'badge-d2',
    sub: 'Quad Hypertrophy, Posterior Chain & Core Routine',
    sections: [
      {
        title: 'Quads & Glutes',
        tag: 'd2_tag_quads',
        color: 'red',
        exercises: [
          E(
            'd2_smithSquat',
            'd2_ss',
            'Barbell Smith Back Squat',
            'Quads & Glutes',
            '2 × 6–10 | Rest 2–3m | RIR 1–2',
            150,
            2,
            [
              V(
                'smith_squat',
                'Smith Machine',
                'Feet shoulder-width, toes out slightly',
                'Feet shoulder-width, toes out slightly. 🔥 Drop ~5% on Set 2.',
                [
                  [80, 8, 2, 'Working'],
                  [75, 8, 1, 'Working']
                ]
              )
            ]
          ),
          E('d2_legext', 'd2_le', 'Leg Extension', 'Quads', '3 × 15–20 + dropset | Rest 60–90s | RIR 0–2', 90, 3, [
            V(
              'leg_ext_mach',
              'Leg Extension Machine',
              'Pad beneath ankle joint',
              'Control negative; hold 1s squeeze at top. 🔥 Dropset on last set.',
              [
                [50, 15, 2, 'Working'],
                [50, 15, 1, 'Working'],
                [30, 15, 0, 'Drop Set']
              ]
            )
          ]),
          E(
            'd2_quadpress',
            'd2_qp',
            'Unilateral Quad / Glute Press',
            'Quads & Glutes',
            '2 × 8–12 | Rest 90–120s | RIR 1–2',
            105,
            2,
            [
              V(
                'bulgarian',
                'Bulgarian Split Squat',
                'Bench at knee height',
                'Torso slight forward lean for glutes / upright for quads. Control descent.',
                [
                  [20, 10, 2, 'Working'],
                  [20, 10, 1, 'Working']
                ]
              ),
              V(
                'db_lunges',
                'DB Lunges',
                'Walking or in-place',
                'Torso slight forward lean for glutes / upright for quads. Control descent.',
                [
                  [20, 10, 2, 'Working'],
                  [20, 10, 1, 'Working']
                ]
              )
            ]
          )
        ]
      },
      {
        title: 'Hams & Hips',
        tag: 'd2_tag_hams',
        color: 'blue',
        exercises: [
          E('d2_hamstring', 'd2_hm', 'Hamstring Isolation', 'Hamstrings', '2 × 10–15 | Rest 60–90s | RIR 1–2', 90, 2, [
            V(
              'seated_curl',
              'Seated Leg Curl',
              'Hips pinned down',
              'Hips strapped/pinned down firmly. Slow eccentric stretch.',
              [
                [40, 12, 2, 'Working'],
                [40, 10, 1, 'Working']
              ]
            ),
            V(
              'lying_curl',
              'Lying Leg Curl',
              'Hips pinned down',
              'Hips strapped/pinned down firmly. Slow eccentric stretch.',
              [
                [35, 12, 2, 'Working'],
                [35, 10, 1, 'Working']
              ]
            )
          ]),
          E('d2_adductor', 'd2_ad', 'Hip Adduction', 'Adductors', '2 × 12–20 | Rest 60s | RIR 1–2', 60, 2, [
            V(
              'mach_adductor',
              'Machine Adductor',
              'Seated upright',
              'Full stretch at open position; pause 1s at full squeeze.',
              [
                [40, 15, 2, 'Working'],
                [40, 15, 1, 'Working']
              ]
            )
          ]),
          E('d2_abductor', 'd2_ab', 'Hip Abduction', 'Glute Medius', '2 × 12–20 | Rest 60s | RIR 1–2', 60, 2, [
            V(
              'mach_abductor',
              'Machine Abductor',
              'Hinge slightly forward',
              'Hinge slightly forward at hips for maximum glute recruitment.',
              [
                [40, 15, 2, 'Working'],
                [40, 15, 1, 'Working']
              ]
            )
          ])
        ]
      },
      {
        title: 'Calves & Core',
        tag: 'd2_tag_calves_core',
        color: 'green',
        exercises: [
          E(
            'd2_calf',
            'd2_cl',
            'Calf Isolation',
            'Gastrocnemius',
            '3 × 12–20 + dropset | Rest 60–90s | RIR 1–2',
            75,
            3,
            [
              V(
                'smith_calf',
                'Smith Machine Calf Raise',
                'Elevated toes for deep stretch',
                'Elevated toes for deep stretch. 🔥 Dropset on last set. Keep reps >12.',
                [
                  [40, 15, 2, 'Working'],
                  [40, 15, 1, 'Working'],
                  [20, 15, 0, 'Drop Set']
                ]
              ),
              V(
                'standing_calf_mach',
                'Standing Machine Calf Raise',
                'Elevated toes for deep stretch',
                'Elevated toes for deep stretch. 🔥 Dropset on last set. Keep reps >12.',
                [
                  [60, 15, 2, 'Working'],
                  [60, 15, 1, 'Working']
                ]
              )
            ]
          ),
          E('d2_lowerabs', 'd2_la', 'Lower Abs', 'Lower Abdominals', '2–3 × 10–20 | Rest 60s | RIR 1–2', 60, 3, [
            V(
              'hanging_raise',
              "Hanging / Captain's Chair Leg Raise",
              'Bodyweight',
              'Posterior pelvic tilt; curl pelvis up, do not just swing legs.',
              [
                [0, 15, 2, 'Working'],
                [0, 15, 1, 'Working'],
                [0, 12, 1, 'Working']
              ]
            )
          ]),
          E(
            'd2_upperabs',
            'd2_ua',
            'Upper / Total Abs',
            'Upper Abdominals',
            '2–3 × 12–20 | Rest 60s | RIR 1–2',
            60,
            3,
            [
              V(
                'mach_crunch',
                'Machine Crunches',
                'Pad across chest',
                'Exhale fully at bottom; crunch ribcage down toward pelvis.',
                [
                  [45, 15, 2, 'Working'],
                  [45, 15, 1, 'Working'],
                  [40, 12, 1, 'Working']
                ]
              ),
              V(
                'cable_crunch',
                'Cable Crunch',
                'High pulley rope / mat',
                'Exhale fully at bottom; crunch ribcage down toward pelvis.',
                [
                  [25, 15, 2, 'Working'],
                  [25, 15, 1, 'Working'],
                  [20, 12, 1, 'Working']
                ]
              )
            ]
          )
        ]
      }
    ]
  },
  3: {
    title: '⚡ Back • Rear Delts • Triceps • Traps',
    badge: 'Day 3 Focus',
    badgeClass: 'badge-d3',
    sub: 'Pull Hypertrophy & Arm Thickness Routine',
    sections: [
      {
        title: 'Back Width & Thickness',
        tag: 'd3_tag_back',
        color: 'red',
        exercises: [
          E(
            'd3_backthickness',
            'd3_bt',
            'Upper / Mid Back Thickness',
            'Back Thickness',
            '2–3 × 6–10 | Rest 2–3m | RIR 1–2',
            150,
            3,
            [
              V(
                'tbar',
                'T-Bar Row',
                'Lower / upper grip',
                'Chest firmly on pad. Drive elbows out ~45°–60°; squeeze shoulder blades.',
                [
                  [40, 9, 2, 'Working'],
                  [40, 8, 1, 'Working'],
                  [40, 7, 1, 'Working']
                ]
              ),
              V(
                'bent_row',
                'Bent-Over Barbell Row',
                'Overhand grip',
                'Drive elbows out ~45°–60°; squeeze shoulder blades.',
                [
                  [50, 8, 2, 'Working'],
                  [50, 8, 1, 'Working'],
                  [50, 8, 1, 'Working']
                ]
              ),
              V(
                'machine_row',
                'Wide-Grip Machine Row',
                'Chest on pad',
                'Chest firmly on pad. Drive elbows out ~45°–60°; squeeze shoulder blades.',
                [
                  [55, 10, 2, 'Working'],
                  [55, 8, 1, 'Working'],
                  [55, 8, 1, 'Working']
                ]
              )
            ]
          ),
          E(
            'd3_latwidth',
            'd3_lw',
            'Vertical Pull / Lat Width',
            'Latissimus Dorsi',
            '2 × 8–12 | Rest 90–120s | RIR 1–2',
            105,
            2,
            [
              V(
                'mag_pulldown',
                'Mag-Grip Lat Pulldown',
                'Hole 5',
                'Drive elbows down into back pockets; slight torso arch. Control stretch up.',
                [
                  [50, 10, 2, 'Working'],
                  [50, 7, 1, 'Working']
                ]
              ),
              V(
                'pullups',
                'Close-Grip Pull-Ups',
                'Bodyweight (BW)',
                'Drive elbows down into back pockets; slight torso arch. Control stretch up.',
                [
                  [0, 8, 2, 'Working'],
                  [0, 6, 1, 'Working']
                ]
              ),
              V(
                'underhand_pulldown',
                'Underhand Pulldown',
                'Close-grip underhand',
                'Drive elbows down into back pockets; slight torso arch. Control stretch up.',
                [
                  [50, 10, 2, 'Working'],
                  [50, 8, 1, 'Working']
                ]
              )
            ]
          ),
          E('d3_unilat', 'd3_ul', 'Unilateral Lat Isolation', 'Lats', '2 × 10–15 | Rest 60–90s | RIR 1–2', 90, 2, [
            V(
              'single_arm_cable',
              'Single-Arm Cable Pulldown',
              'D-Handle',
              'Lean torso toward working side. Drive elbow down to hip crest; no torso rotation.',
              [
                [25, 12, 2, 'Working'],
                [25, 12, 1, 'Working']
              ]
            ),
            V(
              'half_kneeling',
              'Half-Kneeling Pulldown',
              'Single pulley',
              'Lean torso toward working side. Drive elbow down to hip crest; no torso rotation.',
              [
                [25, 12, 2, 'Working'],
                [25, 12, 1, 'Working']
              ]
            )
          ])
        ]
      },
      {
        title: 'Rear Delts',
        tag: 'd3_tag_reardelts',
        color: 'coral',
        exercises: [
          E(
            'd3_reardelt',
            'd3_rd',
            'Rear Delt Isolation',
            'Rear Delts',
            '2–3 × 12–20 + dropset | Rest 60–90s | RIR 0–2',
            75,
            3,
            [
              V('rev_pec_dec', 'Reverse Pec Dec Fly', 'Hole 7', 'Pull in 30° scapular plane. 🔥 Dropset on last set.', [
                [30, 15, 2, 'Working'],
                [30, 15, 1, 'Working'],
                [15, 15, 0, 'Drop Set']
              ]),
              V(
                'single_arm_cable_fly',
                'Single-Arm Cable Fly',
                'Shoulder height',
                'Pull in 30° scapular plane. 🔥 Dropset on last set.',
                [
                  [10, 15, 2, 'Working'],
                  [10, 15, 1, 'Working'],
                  [5, 15, 0, 'Drop Set']
                ]
              ),
              V(
                'cable_rear_delt',
                'Cable Rear Delt Fly',
                'Shoulder height, dual pulleys',
                'Pull in 30° scapular plane. 🔥 Dropset on last set.',
                [
                  [15, 15, 2, 'Working'],
                  [15, 15, 1, 'Working'],
                  [10, 12, 0, 'Drop Set']
                ]
              )
            ]
          )
        ]
      },
      {
        title: 'Triceps',
        tag: 'd3_tag_triceps',
        color: 'blue',
        exercises: [
          E(
            'd3_tricepskull',
            'd3_ts',
            'Triceps (Long Head Stretch)',
            'Triceps Long Head',
            '2–3 × 8–12 | Rest 90s | RIR 1–2',
            90,
            3,
            [
              V(
                'db_skull',
                'DB Skull Crusher',
                'Flat / slight incline bench',
                'Upper arms angled slightly back past 90°; get deep elbow stretch.',
                [
                  [15, 10, 2, 'Working'],
                  [15, 10, 1, 'Working'],
                  [12.5, 10, 1, 'Working']
                ]
              ),
              V(
                'ez_skull',
                'EZ-Bar Skull Crusher',
                'EZ-Bar',
                'Upper arms angled slightly back past 90°; get deep elbow stretch.',
                [
                  [30, 10, 2, 'Working'],
                  [30, 8, 1, 'Working'],
                  [30, 8, 1, 'Working']
                ]
              )
            ]
          ),
          E(
            'd3_triceppushdown',
            'd3_tp',
            'Triceps (Lateral / Medial)',
            'Triceps Lateral & Medial Heads',
            '2 × 10–15 | Rest 60–90s | RIR 1–2',
            75,
            2,
            [
              V(
                'vulken',
                'Vulken Grip Pushdown',
                'Single pulley, overhand',
                'Pin elbows to ribs. Flare out at bottom; lock out cleanly.',
                [
                  [20, 12, 2, 'Working'],
                  [20, 12, 1, 'Working']
                ]
              ),
              V(
                'rope',
                'Rope Pushdown',
                'Single pulley rope',
                'Pin elbows to ribs. Flare out at bottom; lock out cleanly.',
                [
                  [20, 12, 2, 'Working'],
                  [20, 12, 1, 'Working']
                ]
              )
            ]
          ),
          E(
            'd3_tricepoverhead',
            'd3_to',
            'Triceps Extension',
            'Triceps Long Head',
            '2 × 10–15 | Rest 60–90s | RIR 1–2',
            75,
            2,
            [
              V(
                'single_arm_pushdown',
                'Single-Arm Pushdown',
                'Single pulley, vulken grip',
                'Pin elbow to side; focus on full extension and lock at bottom.',
                [
                  [10, 12, 2, 'Working'],
                  [10, 12, 1, 'Working']
                ]
              ),
              V(
                'overhead_ext',
                'Overhead Cable Extension',
                'Pulley at shoulder/chest height, face away',
                'Face away, keep elbow stable; get full stretch behind head.',
                [
                  [15, 12, 2, 'Working'],
                  [15, 12, 1, 'Working']
                ]
              )
            ]
          )
        ]
      },
      {
        title: 'Traps',
        tag: 'd3_tag_traps',
        color: 'green',
        exercises: [
          E('d3_trap', 'd3_tr', 'Trap Hypertrophy', 'Upper Trapezius', '3 × 8–15 | Rest 90–120s | RIR 1–2', 105, 3, [
            V(
              'shrug_mach',
              'Shrug Machine',
              'Seat adjusted, arms straight',
              'Straight arms; elevate shoulders straight up to ears. Hold 1s peak squeeze.',
              [
                [60, 12, 2, 'Working'],
                [60, 10, 1, 'Working'],
                [60, 10, 1, 'Working']
              ]
            ),
            V(
              'smith_shrug',
              'Smith Shrugs',
              'Arms straight at sides',
              'Straight arms; elevate shoulders straight up to ears. Hold 1s peak squeeze.',
              [
                [50, 10, 2, 'Working'],
                [50, 10, 1, 'Working'],
                [50, 10, 1, 'Working']
              ]
            ),
            V(
              'db_shrug',
              'DB Shrugs',
              'Arms straight, neutral grip',
              'Straight arms; elevate shoulders straight up to ears. Hold 1s peak squeeze.',
              [
                [30, 12, 2, 'Working'],
                [30, 12, 1, 'Working'],
                [30, 10, 1, 'Working']
              ]
            )
          ])
        ]
      }
    ]
  }
};
