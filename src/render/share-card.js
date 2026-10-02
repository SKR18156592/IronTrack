import { showToast } from '../ui.js';

export function generateShareCard(record) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  // Drawn in the current theme accent, like the rest of the app.
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f3ff';

  const bgGrad = ctx.createLinearGradient(0, 0, 800, 1000);
  bgGrad.addColorStop(0, '#07080c');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#07080c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 1000);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.strokeRect(30, 30, 740, 940);
  ctx.shadowBlur = 0;

  ctx.fillStyle = accent;
  ctx.fillRect(30, 30, 740, 8);

  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('⚡ IRONTRACK', 60, 90);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`DATE: ${record.date}`, 60, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(record.dayTitle, 60, 190);

  let totalTonnage = 0;
  let completedSets = 0;
  record.exercises.forEach(ex => {
    ex.sets.forEach(s => {
      if (s.done !== false) {
        completedSets++;
        const w = parseFloat(s.weight), r = parseFloat(s.reps);
        if (!isNaN(w) && !isNaN(r)) totalTonnage += w * r;
      }
    });
  });

  const drawStatBox = (x, y, w, h, label, val, color) => {
    ctx.fillStyle = 'rgba(20, 23, 38, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(label.toUpperCase(), x + 24, y + 36);

    ctx.fillStyle = color;
    ctx.font = '800 32px "JetBrains Mono", monospace';
    ctx.fillText(val, x + 24, y + 80);
  };

  drawStatBox(60, 230, 335, 110, 'Total Volume Tonnage', `${totalTonnage.toFixed(0)} kg`, accent);
  drawStatBox(405, 230, 335, 110, 'Completed Sets', `${completedSets} Sets`, '#f8fafc');
  drawStatBox(60, 360, 335, 110, 'Session Duration', record.duration, '#f8fafc');
  drawStatBox(405, 360, 335, 110, 'Body Weight', `${record.bodyWeight} kg`, '#f8fafc');

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('EXERCISE BREAKDOWN', 60, 520);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 535);
  ctx.lineTo(740, 535);
  ctx.stroke();

  let startY = 575;
  record.exercises.slice(0, 5).forEach((ex, idx) => {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${idx + 1}. ${ex.name}`, 60, startY);

    const workingSets = ex.sets.filter(s => s.done !== false);
    const setsSummary = workingSets.map(s => `${s.weight}kg×${s.reps}`).join(', ');
    ctx.fillStyle = accent;
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(setsSummary, 60, startY + 22);

    startY += 55;
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('⚡ Progress via Progressive Overload • irontrack.app', 60, 930);

  const link = document.createElement('a');
  link.download = `IronTrack_Summary_${record.date}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('📸 Shareable Workout Card downloaded!', 'success');
}
