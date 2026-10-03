// Anatomical front/back figure for the muscle recovery card, in a 120 x 246 box, symmetric about x = 60.
// Everything is drawn for the figure's right side (the viewer's left) and mirrored. Each muscle belongs to
// one of the app's muscle groups and is tinted by that group's status through CSS (data-status).

// Outline of the body's right half, from the top of the head down to the crotch, using only M, L and C.
const BODY_HALF =
  'M60 4 C53 4 49 9 49 17 C49 24 51 29 54 31 L54 37 C50 40 41 42 33 44 C27 46 24 51 24 58 ' +
  'C23 70 22 84 21 98 C19 110 17 122 17 134 C16 140 16 146 18 150 C20 152 23 151 24 148 ' +
  'C25 142 25 138 26 134 C28 122 30 110 31 100 C32 90 34 78 36 67 C37 67 38 67 39 68 ' +
  'C40 80 41 92 43 104 C42 114 38 122 38 132 C37 150 38 166 40 182 C37 196 37 210 42 226 ' +
  'L41 234 C39 238 40 241 46 241 L52 241 C53 236 53 232 52 226 C54 210 55 196 53 184 ' +
  'C56 166 58 150 59 136 L60 134';

const mirrorX = (x, y) => `${+(120 - x).toFixed(2)} ${y}`;

// Closes a half outline into the whole body: the half, then its mirror image traced back up.
export function mirroredOutline(half) {
  const nums = half.match(/[A-Z]|-?[\d.]+/g);
  const segs = [];
  let start = null;
  for (let i = 0; i < nums.length;) {
    const cmd = nums[i++];
    const count = cmd === 'C' ? 3 : 1;
    const pts = [];
    for (let k = 0; k < count; k++) pts.push([+nums[i++], +nums[i++]]);
    if (cmd === 'M') start = pts[0];
    else segs.push({ cmd, from: segs.length ? segs[segs.length - 1].to : start, pts, to: pts[pts.length - 1] });
  }
  const back = segs
    .slice()
    .reverse()
    .map(({ cmd, from, pts }) =>
      cmd === 'C' ? `C${mirrorX(...pts[1])} ${mirrorX(...pts[0])} ${mirrorX(...from)}` : `L${mirrorX(...from)}`
    );
  return `${half} ${back.join(' ')} Z`;
}

const BODY_OUTLINE = mirroredOutline(BODY_HALF);

// Muscles and landmarks the app doesn't track, drawn for shape only: [name, path].
const DETAIL = {
  front: [
    ['Abs', 'M53 80.5 C53 84 53 87 53.5 89 L59 89.5 L59 80 C57 79.5 55 79.8 53 80.5 Z'],
    ['Abs', 'M53.5 91 C53.3 94 53.3 97 53.6 100 L59 100.5 L59 91 Z'],
    ['Abs', 'M53.6 102 C53.5 105 53.6 108 54 111 L59 111.5 L59 102 Z'],
    ['Abs', 'M54 113 C54.5 117 56 121 59 124 L59 113 Z'],
    [
      'Obliques',
      'M44 88 C45.5 96 46.5 104 47 112 C48.5 115 50 116.5 52.5 117.5 C52 108 52 96 52 84 C49.5 85 47 86.5 44 88 Z'
    ],
    ['Serratus', 'M40 74 L44 77 L44 80.5 L40.5 78.5 Z'],
    ['Serratus', 'M41 80.5 L45 83.5 L45 87 L41.5 85 Z'],
    ['Serratus', 'M42 87 L45.5 90 L45.5 93 L42.5 91 Z'],
    ['Knee', 'M46 181 C45.5 184 46.5 187 48.5 187.5 C50.5 187 51.5 184 51 181 C49.5 180 47.5 180 46 181 Z']
  ],
  back: [['Elbow', 'M26 97 C25 99 25.5 101 27.5 101.5 C29.5 101 30 99 29 97 C28 96.3 27 96.3 26 97 Z']]
};

// The muscles of each view, by the group whose training tints them: [name, path].
const MUSCLES = {
  front: {
    shoulders: [
      ['Upper traps', 'M54 37.5 C50 40 43 42 36.5 44 C42 44.5 49 43.5 54 41.5 Z'],
      ['Side delt', 'M33 45 C27 46 24 51 24.5 59 C25 64 26 68 28 71 C29 62 30 54 33 45 Z'],
      ['Front delt', 'M34 45 C31 54 29.5 63 28.5 71 C32 64 35.5 58 38.5 54 C38.5 50 37 47 34 45 Z']
    ],
    chest: [
      ['Upper chest', 'M59 49 C52 47 44 48 39 53 C42 55 50 56.5 59 56.5 Z'],
      ['Mid chest', 'M59 57.5 C50 57.5 42 56.5 38.5 55 C36 61 36 67 39 72 C45 78 54 79 59 76 Z']
    ],
    arms: [
      [
        'Biceps',
        'M28.5 69 C26 76 25.2 86 25.8 96 C27.5 99.5 30.5 99.5 31.6 97 C32.6 90 33.6 80 35 70 C33 68 30.5 67.5 28.5 69 Z'
      ],
      [
        'Brachialis',
        'M24.4 66 C23.6 74 23 86 22.4 96 C23.3 98 24.5 98 25 96.5 C24.5 86 25.2 76 28 69 C26.5 67 25.3 66 24.4 66 Z'
      ],
      [
        'Brachioradialis',
        'M21.5 101 C20 110 18.6 120 18.3 131 C19.5 132.5 21 132.5 22 131 C23 120 24.5 110 26.2 102 C24.8 100.6 23 100.4 21.5 101 Z'
      ],
      [
        'Forearm flexors',
        'M26.8 102 C25.2 110 23.8 120 22.8 131 C23.8 133 25 133.5 25.8 133 C27 122 28.8 112 30.6 102.5 C29.5 101 28 101 26.8 102 Z'
      ]
    ],
    legs: [
      [
        'Hip abductors',
        'M38.6 128 C38 133 38 138 38.6 142 C40.5 139 42.5 136 44.6 133.4 C42.6 130.6 40.6 129 38.6 128 Z'
      ],
      [
        'Outer quad',
        'M38.6 143 C37.9 155 38.3 168 40.6 179 C42.2 181 43.8 180.6 44.6 178.4 C43.2 165 43.2 150 45 137.4 C42.6 138.6 40.4 140.6 38.6 143 Z'
      ],
      [
        'Rectus femoris',
        'M45.8 136.6 C44.2 147 43.9 161 45.3 176 C46.8 178.6 49.2 178.6 50.2 176.2 C50.4 165 49 150 45.8 136.6 Z'
      ],
      ['Sartorius', 'M44.8 131.4 C47.8 142 51.6 155 55.2 167 L56.6 162 C53.8 152 50.4 141 47.8 131.4 Z'],
      [
        'Inner quad',
        'M50.9 164 C50.4 170 50.6 175.5 51.6 179.6 C53.4 180.6 54.6 179.2 55 175.6 C55.2 171 54.2 167 50.9 164 Z'
      ],
      [
        'Adductors',
        'M48.8 132.6 C51.8 142 54.8 151 57.1 160 C57.9 152 58.4 144 58.8 137 C55.8 134.4 52.4 133 48.8 132.6 Z'
      ],
      [
        'Tibialis',
        'M41.6 189 C39.8 197 39.6 207 41.4 217 C42.2 221 43.4 223.5 44.6 224.5 L45.6 224.5 C45.4 214 45.6 201 46.4 190 C45 188.4 43.2 188.2 41.6 189 Z'
      ],
      ['Calves', 'M48.2 189.6 C50 196 51.5 204 51.6 213 C53.2 208 54.4 201 54.2 195 C53.6 191 51.2 189 48.2 189.6 Z']
    ]
  },
  back: {
    // The app counts trap exercises as shoulders.
    shoulders: [
      ['Traps', 'M59 33 L54.5 37 C50 40 43 42.5 36 45 C43 48 50 53 55 62 C57 68 58.5 76 59 82 Z'],
      [
        'Rear delt',
        'M35 46 C29 47 24.5 51 24.5 59 C25 63 26 66 27 68 C30 62 33.5 57 37.5 53 C37.5 50 36.5 47.5 35 46 Z'
      ]
    ],
    back: [
      ['Infraspinatus', 'M38.4 50 C38.5 57 40.5 64 43.5 69.5 C47 67 50.5 63.5 53.5 61 C50 56 44.5 52 38.4 50 Z'],
      [
        'Lats',
        'M38.6 69 C39 79 40.5 89 43 97.5 C46 100.5 49 102 52.3 103 C53.3 96 55 90 58.5 85 C56 80.5 54.5 72 54.5 64 C51 67 47.5 70 44 72 C42 72 40 70.8 38.6 69 Z'
      ],
      [
        'Lower back',
        'M56.2 88.5 C55.3 95 54.6 103 54.4 111 C55.8 113.5 57.3 114 58.6 113 L58.6 86 C57.7 86.5 56.9 87.3 56.2 88.5 Z'
      ]
    ],
    arms: [
      [
        'Triceps (lateral head)',
        'M25.2 61 C23.4 70 22.6 82 22.8 93 C24.5 96 27.6 95.6 28.6 92 C28.2 81 28.8 70 30.4 61.4 C28.6 60.4 26.8 60.3 25.2 61 Z'
      ],
      [
        'Triceps (long head)',
        'M31.2 62 C30 72 29.4 84 30.2 94 C31.4 95.8 32.6 95 33 92.6 C33.8 84 34.8 74 35.6 64.5 C34.3 62.6 32.7 61.7 31.2 62 Z'
      ],
      [
        'Forearm extensors',
        'M21.5 102.5 C19.8 111 18.6 121 18.3 131 C19.8 132.6 21.6 132.8 22.8 131.5 C23.6 121 25 111 26.8 103 C25.2 101.8 23.2 101.7 21.5 102.5 Z'
      ],
      [
        'Forearm flexors',
        'M27.4 103 C25.8 111 24.4 121 23.6 131.6 C24.6 133 25.6 133.3 26.2 133 C27.4 122 29 112 30.6 103.5 C29.6 102.4 28.4 102.3 27.4 103 Z'
      ]
    ],
    legs: [
      ['Glute medius', 'M40 112 C38.5 116 38.5 121 39.5 124 C43 119 48 116 53 115 C49 112 44 111 40 112 Z'],
      ['Glutes', 'M39.5 125 C38 131 39 137 41 141 C47 145 54 145 59 142 L59 117 C53 117 45 119 39.5 125 Z'],
      [
        'Hamstrings (outer)',
        'M38.8 147 C38.2 158 38.8 170 41 180.5 C42.8 182 44.6 181.4 45.4 179.6 C45.6 170 47 158 49.6 145.4 C46 145 42 145.6 38.8 147 Z'
      ],
      [
        'Hamstrings (inner)',
        'M50.6 145.4 C49 157 48.8 168 49.8 179.6 C51.2 181.6 53 181.2 53.8 179 C55.4 168 57 157 58.4 146.4 C55.8 146.4 53.2 146 50.6 145.4 Z'
      ],
      [
        'Calves (outer)',
        'M40.6 188 C38.4 195 38.4 204 41 212 C43 214 45.5 213.6 46.6 211.5 C46.2 203 46.2 195 46.8 187.6 C44.8 186.6 42.5 186.8 40.6 188 Z'
      ],
      [
        'Calves (inner)',
        'M47.8 187.6 C47.8 196 48.2 204 49 213 C51 214.6 53 214 54 211 C55 203 55 195 53.6 188.4 C51.8 186.8 49.6 186.8 47.8 187.6 Z'
      ],
      ['Soleus', 'M43 214.5 C43.5 219 44.5 223 46 226 L50 226 C51 222 52 218 52.5 214.5 C50 216.5 46 216.5 43 214.5 Z']
    ]
  }
};

const MIRROR = 'matrix(-1 0 0 1 120 0)';

// A shape on both sides, with a tooltip.
const pair = (d, tip) =>
  `<path d="${d}"><title>${tip}</title></path><path d="${d}" transform="${MIRROR}"><title>${tip}</title></path>`;
// The same shape on both sides, without tooltips (for the shading layer).
const bare = d => `<path d="${d}"/><path d="${d}" transform="${MIRROR}"/>`;

// view: 'front' or 'back'. statusByGroup: group -> { key, label }. groupLabel: group -> display name.
export function bodyFigure(view, statusByGroup, groupLabel) {
  const groups = Object.entries(MUSCLES[view]);
  const muscles = groups
    .map(([g, list]) => {
      const { key, label } = statusByGroup[g];
      const shapes = list.map(([name, d]) => pair(d, `${name} (${groupLabel[g]}): ${label}`)).join('');
      return `<g class="muscle" data-status="${key}">${shapes}</g>`;
    })
    .join('');
  const shading = groups.flatMap(([, list]) => list.map(([, d]) => bare(d))).join('');
  const detail = DETAIL[view].map(([name, d]) => pair(d, name)).join('');
  const shade = `body-shade-${view}`;
  const title = view === 'front' ? 'Front' : 'Back';
  return `<figure class="body-figure">
    <svg viewBox="0 0 120 246" role="img" aria-label="${title} view, tinted by recovery">
      <defs>
        <radialGradient id="${shade}" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stop-color="#fff" stop-opacity="0.22"/>
          <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
        </radialGradient>
      </defs>
      <path class="body-base" d="${BODY_OUTLINE}"/>
      <g class="body-detail">${detail}</g>${muscles}
      <g class="muscle-shade" fill="url(#${shade})">${shading}</g>
    </svg>
    <figcaption>${title}</figcaption>
  </figure>`;
}
