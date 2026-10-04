// Catches likely typos in common email domains ('gmial.com', 'gmail.con') before an account is created
// with an address nobody can receive mail at. Whether an address really exists can only be proven by the
// confirmation email; this just saves the round trip for the common slips.

const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'rediffmail.com'
];

// Real domains that happen to be close to a common one: never "corrected".
const KNOWN_DOMAINS = new Set([
  'mail.com',
  'email.com',
  'ymail.com',
  'gmx.com',
  'gmx.net',
  'msn.com',
  'yahoo.in',
  'yahoo.co.uk',
  'hotmail.co.uk',
  'outlook.in',
  'live.in',
  'mac.com'
]);

// Edit distance (insert, delete, substitute, or swap two neighbours).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The address with its domain corrected, or null if it looks fine (or isn't close to a common domain).
export function suggestEmailFix(email) {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain) || KNOWN_DOMAINS.has(domain)) return null;
  let best = null;
  for (const candidate of COMMON_DOMAINS) {
    const d = distance(domain, candidate);
    if (d <= 2 && (!best || d < best.d)) best = { candidate, d };
  }
  return best ? `${local}@${best.candidate}` : null;
}
