// Round axis ticks (0 / 3k / 6k …) instead of fractions of the data's maximum.
export function niceTicks(min, max, count = 4) {
  if (!(max > min)) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 3, 5, 10].map(m => m * mag).find(s => s >= raw - 1e-9);
  const start = Math.floor(min / step + 1e-9) * step;
  const end = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

// 12000 -> '12k', 2500 -> '2.5k', 85 -> '85'.
export function formatTick(v) {
  if (Math.abs(v) >= 1000) return String(+(v / 1000).toFixed(1)) + 'k';
  return String(+v.toFixed(1));
}
